-- Production-safe airline accounts repair.
-- Creates missing airline-ledger schema objects and idempotently restores
-- the revision/save RPCs with full dual-currency and transaction-type support.
-- It never inserts demo financial records.

create table if not exists public.airline_ledger_airlines (
  id text primary key, name text not null, code text not null default '--',
  opening_balance numeric not null default 0, opening_balance_date date not null default current_date,
  sort_order int not null default 0, created_at timestamptz not null default now()
);

alter table public.airline_ledger_airlines add column if not exists opening_balance_date date not null default current_date;
alter table public.airline_ledger_airlines add column if not exists currency text not null default 'PKR';
alter table public.airline_ledger_airlines add column if not exists roe numeric not null default 1;
alter table public.airline_ledger_airlines add column if not exists opening_balance_foreign numeric default null;

create table if not exists public.airline_ledger_agents (
  name text primary key, sort_order int not null default 0, created_at timestamptz not null default now()
);

create table if not exists public.airline_ledger_transactions (
  id text primary key, airline_id text not null, date date, agent_name text, pax_name text,
  sector text, pnr text, ticket_sales numeric, debit_in_id text, credit_from_id numeric,
  pax_contact text, void_charges numeric, sort_order int not null default 0, created_at timestamptz not null default now()
);

alter table public.airline_ledger_transactions add column if not exists currency text default null;
alter table public.airline_ledger_transactions add column if not exists roe numeric default null;
alter table public.airline_ledger_transactions add column if not exists foreign_amount numeric default null;
alter table public.airline_ledger_transactions add column if not exists transaction_type text not null default 'Add Transaction';
alter table public.airline_ledger_transactions add column if not exists received_via text default null;
alter table public.airline_ledger_transactions add column if not exists received_via_account_id text default null;

create index if not exists airline_ledger_tx_airline_idx on public.airline_ledger_transactions (airline_id, sort_order);

create table if not exists public.airline_ledger_meta (
  id smallint primary key default 1 check (id = 1), revision bigint not null default 1, updated_at timestamptz not null default now()
);
insert into public.airline_ledger_meta (id, revision) values (1, 1) on conflict (id) do nothing;

create table if not exists public.airline_ledger_audit (
  id uuid primary key default gen_random_uuid(), revision bigint not null, action text not null,
  snapshot jsonb not null, created_at timestamptz not null default now()
);
create index if not exists airline_ledger_audit_revision_idx on public.airline_ledger_audit (revision desc, created_at desc);

alter table public.airline_ledger_airlines enable row level security;
alter table public.airline_ledger_agents enable row level security;
alter table public.airline_ledger_transactions enable row level security;
alter table public.airline_ledger_meta enable row level security;
alter table public.airline_ledger_audit enable row level security;

revoke all on public.airline_ledger_airlines from anon, authenticated;
revoke all on public.airline_ledger_agents from anon, authenticated;
revoke all on public.airline_ledger_transactions from anon, authenticated;
revoke all on public.airline_ledger_meta from anon, authenticated;
revoke all on public.airline_ledger_audit from anon, authenticated;

grant all on public.airline_ledger_airlines to service_role;
grant all on public.airline_ledger_agents to service_role;
grant all on public.airline_ledger_transactions to service_role;
grant select, update on public.airline_ledger_meta to service_role;
grant select, insert on public.airline_ledger_audit to service_role;

create or replace function public.airline_ledger_touch_revision()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('rohi.airline_ledger_save', true), '') = '1' then return coalesce(NEW, OLD); end if;
  update public.airline_ledger_meta set revision = revision + 1, updated_at = now() where id = 1;
  return coalesce(NEW, OLD);
end; $$;

drop trigger if exists airline_ledger_revision_airlines on public.airline_ledger_airlines;
drop trigger if exists airline_ledger_revision_agents on public.airline_ledger_agents;
drop trigger if exists airline_ledger_revision_transactions on public.airline_ledger_transactions;
create trigger airline_ledger_revision_airlines after insert or update or delete on public.airline_ledger_airlines for each row execute function public.airline_ledger_touch_revision();
create trigger airline_ledger_revision_agents after insert or update or delete on public.airline_ledger_agents for each row execute function public.airline_ledger_touch_revision();
create trigger airline_ledger_revision_transactions after insert or update or delete on public.airline_ledger_transactions for each row execute function public.airline_ledger_touch_revision();

create or replace function public.get_airline_ledger_revision()
returns bigint language sql security definer set search_path = public as $$
  select revision from public.airline_ledger_meta where id = 1;
$$;

create or replace function public.save_airline_ledger(p_data jsonb, p_expected_revision bigint)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_revision bigint;
  v_new_revision bigint;
  v_before jsonb;
  v_airlines jsonb;
  v_agents jsonb;
  v_transactions jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('rohi:airline-ledger', 0));
  select revision into v_revision
    from public.airline_ledger_meta where id = 1 for update;

  if v_revision is null then
    insert into public.airline_ledger_meta (id, revision)
    values (1, 1) on conflict (id) do nothing;
    select revision into v_revision
      from public.airline_ledger_meta where id = 1 for update;
  end if;

  if p_expected_revision is distinct from v_revision then
    raise exception 'AIRLINE_LEDGER_CONFLICT: database revision % does not match client revision %',
      v_revision, p_expected_revision using errcode = '40001';
  end if;

  v_airlines := coalesce(p_data->'airlines', '[]'::jsonb);
  v_agents := coalesce(p_data->'agents', '[]'::jsonb);
  v_transactions := coalesce(p_data->'transactions', '[]'::jsonb);

  if jsonb_typeof(v_airlines) <> 'array'
     or jsonb_typeof(v_agents) <> 'array'
     or jsonb_typeof(v_transactions) <> 'array' then
    raise exception 'AIRLINE_LEDGER_INVALID_SNAPSHOT: airlines, agents and transactions must be arrays';
  end if;

  if jsonb_array_length(v_airlines) = 0
     and (exists (select 1 from public.airline_ledger_airlines)
          or exists (select 1 from public.airline_ledger_transactions)) then
    raise exception 'AIRLINE_LEDGER_EMPTY_SNAPSHOT_BLOCKED: refusing to replace an existing ledger with an empty airline snapshot';
  end if;

  if exists (
    select 1 from jsonb_array_elements(v_airlines) x
    where nullif(trim(x->>'id'), '') is null
       or nullif(trim(x->>'name'), '') is null
  ) then
    raise exception 'AIRLINE_LEDGER_INVALID_AIRLINE: every account requires a non-empty id and name';
  end if;

  if exists (
    select 1 from (
      select lower(trim(x->>'name')) as key from jsonb_array_elements(v_airlines) x
    ) d group by key having count(*) > 1
  ) then
    raise exception 'AIRLINE_LEDGER_DUPLICATE_AIRLINE_NAME: account names must be unique';
  end if;

  if exists (
    select 1 from (
      select lower(trim(x->>'code')) as key
      from jsonb_array_elements(v_airlines) x
      where nullif(trim(x->>'code'), '') is not null and trim(x->>'code') <> '--'
    ) d group by key having count(*) > 1
  ) then
    raise exception 'AIRLINE_LEDGER_DUPLICATE_AIRLINE_CODE: IATA codes must be unique';
  end if;

  if exists (
    select 1 from jsonb_array_elements(v_transactions) t
    where not exists (
      select 1 from jsonb_array_elements(v_airlines) a
      where a->>'id' = t->>'airline_id'
    )
  ) then
    raise exception 'AIRLINE_LEDGER_ORPHAN_TRANSACTION: every transaction must reference an existing airline account';
  end if;

  v_before := jsonb_build_object(
    'airlines', coalesce((select jsonb_agg(to_jsonb(a) order by a.sort_order) from public.airline_ledger_airlines a), '[]'::jsonb),
    'agents', coalesce((select jsonb_agg(to_jsonb(a) order by a.sort_order) from public.airline_ledger_agents a), '[]'::jsonb),
    'transactions', coalesce((select jsonb_agg(to_jsonb(t) order by t.airline_id, t.sort_order) from public.airline_ledger_transactions t), '[]'::jsonb)
  );

  perform set_config('rohi.airline_ledger_save', '1', true);

  insert into public.airline_ledger_audit (revision, action, snapshot)
  values (v_revision, 'before-save', v_before);

  insert into public.airline_ledger_airlines
    (id, name, code, opening_balance, opening_balance_date, sort_order, currency, roe, opening_balance_foreign)
  select x.id, x.name, coalesce(x.code, '--'),
         coalesce(x.opening_balance, 0), coalesce(x.opening_balance_date, current_date),
         coalesce(x.sort_order, 0),
         coalesce(nullif(trim(x.currency), ''), 'PKR'),
         coalesce(x.roe, 1),
         x.opening_balance_foreign
  from jsonb_to_recordset(v_airlines)
    as x(id text, name text, code text, opening_balance numeric, opening_balance_date date, sort_order integer, currency text, roe numeric, opening_balance_foreign numeric)
  on conflict (id) do update set
    name = excluded.name, code = excluded.code,
    opening_balance = excluded.opening_balance,
    opening_balance_date = excluded.opening_balance_date,
    sort_order = excluded.sort_order,
    currency = coalesce(excluded.currency, public.airline_ledger_airlines.currency, 'PKR'),
    roe = coalesce(excluded.roe, public.airline_ledger_airlines.roe, 1),
    opening_balance_foreign = coalesce(excluded.opening_balance_foreign, public.airline_ledger_airlines.opening_balance_foreign);

  insert into public.airline_ledger_agents (name, sort_order)
  select x.name, coalesce(x.sort_order, 0)
  from jsonb_to_recordset(v_agents) as x(name text, sort_order integer)
  on conflict (name) do update set sort_order = excluded.sort_order;

  insert into public.airline_ledger_transactions
    (id, airline_id, date, agent_name, pax_name, sector, pnr, ticket_sales,
     debit_in_id, credit_from_id, pax_contact, void_charges, sort_order,
     currency, roe, foreign_amount, transaction_type, received_via, received_via_account_id)
  select x.id, x.airline_id, x.date, x.agent_name, x.pax_name, x.sector, x.pnr,
         x.ticket_sales, x.debit_in_id, x.credit_from_id, x.pax_contact,
         x.void_charges, coalesce(x.sort_order, 0),
         x.currency, x.roe, x.foreign_amount, coalesce(nullif(x.transaction_type, ''), 'Add Transaction'),
         x.received_via, x.received_via_account_id
  from jsonb_to_recordset(v_transactions) as x(
    id text, airline_id text, date date, agent_name text, pax_name text,
    sector text, pnr text, ticket_sales numeric, debit_in_id text,
    credit_from_id numeric, pax_contact text, void_charges numeric, sort_order integer,
    currency text, roe numeric, foreign_amount numeric, transaction_type text,
    received_via text, received_via_account_id text
  )
  on conflict (id) do update set
    airline_id = excluded.airline_id, date = excluded.date,
    agent_name = excluded.agent_name, pax_name = excluded.pax_name,
    sector = excluded.sector, pnr = excluded.pnr, ticket_sales = excluded.ticket_sales,
    debit_in_id = excluded.debit_in_id, credit_from_id = excluded.credit_from_id,
    pax_contact = excluded.pax_contact, void_charges = excluded.void_charges,
    sort_order = excluded.sort_order,
    currency = coalesce(excluded.currency, public.airline_ledger_transactions.currency),
    roe = coalesce(excluded.roe, public.airline_ledger_transactions.roe),
    foreign_amount = coalesce(excluded.foreign_amount, public.airline_ledger_transactions.foreign_amount),
    transaction_type = coalesce(nullif(excluded.transaction_type, ''), public.airline_ledger_transactions.transaction_type, 'Add Transaction'),
    received_via = excluded.received_via,
    received_via_account_id = excluded.received_via_account_id;

  delete from public.airline_ledger_transactions
   where id not in (select x.id from jsonb_to_recordset(v_transactions) as x(id text));

  delete from public.airline_ledger_airlines
   where id not in (select x.id from jsonb_to_recordset(v_airlines) as x(id text));

  delete from public.airline_ledger_agents
   where name not in (select x.name from jsonb_to_recordset(v_agents) as x(name text));

  update public.airline_ledger_meta
     set revision = revision + 1, updated_at = now()
   where id = 1 returning revision into v_new_revision;

  insert into public.airline_ledger_audit (revision, action, snapshot)
  values (v_new_revision, 'after-save', p_data);

  return v_new_revision;
end;
$$;

revoke all on function public.get_airline_ledger_revision() from public, anon, authenticated;
revoke all on function public.save_airline_ledger(jsonb, bigint) from public, anon, authenticated;
grant execute on function public.get_airline_ledger_revision() to service_role;
grant execute on function public.save_airline_ledger(jsonb, bigint) to service_role;

notify pgrst, 'reload schema';
