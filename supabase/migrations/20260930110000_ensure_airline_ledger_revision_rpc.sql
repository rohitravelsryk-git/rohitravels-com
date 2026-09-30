-- Production repair: ensure the airline ledger revision RPC exists even when
-- an earlier ledger safety migration was missed in the target database.
-- This preserves the safety lock: no fallback/demo financial data is created.

create table if not exists public.airline_ledger_meta (
  id smallint primary key default 1 check (id = 1),
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);

insert into public.airline_ledger_meta (id, revision)
values (1, 1)
on conflict (id) do nothing;

create or replace function public.get_airline_ledger_revision()
returns bigint
language sql
security definer
set search_path = public
as $$
  select revision
  from public.airline_ledger_meta
  where id = 1;
$$;

revoke all on function public.get_airline_ledger_revision() from public, anon, authenticated;
grant execute on function public.get_airline_ledger_revision() to service_role;
grant select on public.airline_ledger_meta to service_role;
grant update on public.airline_ledger_meta to service_role;

notify pgrst, 'reload schema';
