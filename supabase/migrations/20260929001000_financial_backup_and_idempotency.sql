-- ROHI financial data safety: idempotent linked entries + backup status.
-- Existing rows are NOT deleted or rewritten by this migration.

alter table public.accounts_book_transactions
  add column if not exists source_key text;

create index if not exists accounts_book_transactions_source_key_idx
  on public.accounts_book_transactions(source_key);

create unique index if not exists accounts_book_transactions_source_key_unique
  on public.accounts_book_transactions(source_key)
  where source_key is not null;

create table if not exists public.rohi_financial_backup_sync (
  id smallint primary key default 1 check (id = 1),
  last_source_revision bigint,
  last_synced_at timestamptz,
  status text not null default 'not_configured',
  error_message text,
  sheet_id text,
  updated_at timestamptz not null default now()
);

insert into public.rohi_financial_backup_sync (id, status)
values (1, 'not_configured')
on conflict (id) do nothing;

alter table public.rohi_financial_backup_sync enable row level security;
revoke all on public.rohi_financial_backup_sync from anon, authenticated;
grant select, insert, update on public.rohi_financial_backup_sync to service_role;

-- A single monotonically increasing revision for the financial backup source.
create table if not exists public.rohi_financial_backup_meta (
  id smallint primary key default 1 check (id = 1),
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);

insert into public.rohi_financial_backup_meta (id, revision)
values (1, 1)
on conflict (id) do nothing;

alter table public.rohi_financial_backup_meta enable row level security;
revoke all on public.rohi_financial_backup_meta from anon, authenticated;
grant select, update on public.rohi_financial_backup_meta to service_role;

create or replace function public.rohi_touch_financial_backup_revision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.rohi_financial_backup_meta
     set revision = revision + 1,
         updated_at = now()
   where id = 1;
  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists rohi_financial_backup_accounts on public.accounts_book_accounts;
drop trigger if exists rohi_financial_backup_transactions on public.accounts_book_transactions;
drop trigger if exists rohi_financial_backup_services on public.accounts_book_services;

create trigger rohi_financial_backup_accounts
after insert or update or delete on public.accounts_book_accounts
for each row execute function public.rohi_touch_financial_backup_revision();

create trigger rohi_financial_backup_transactions
after insert or update or delete on public.accounts_book_transactions
for each row execute function public.rohi_touch_financial_backup_revision();

create trigger rohi_financial_backup_services
after insert or update or delete on public.accounts_book_services
for each row execute function public.rohi_touch_financial_backup_revision();

create or replace function public.get_rohi_financial_backup_revision()
returns bigint
language sql
security definer
set search_path = public
as $$
  select revision from public.rohi_financial_backup_meta where id = 1;
$$;

revoke all on function public.get_rohi_financial_backup_revision() from public, anon, authenticated;
grant execute on function public.get_rohi_financial_backup_revision() to service_role;

-- Future linked entries must supply source_key. The unique index makes retries
-- idempotent instead of creating duplicate ledger rows.
