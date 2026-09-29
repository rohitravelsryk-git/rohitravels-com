-- Repair/reload migration for the banking-grade airline ledger RPC.
-- The original safety migration creates the function. This migration intentionally
-- re-declares the zero-argument read RPC and refreshes PostgREST's schema cache.
-- It does not weaken the safety lock or create demo/default financial data.

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

notify pgrst, 'reload schema';
