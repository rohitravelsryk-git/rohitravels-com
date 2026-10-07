-- One-way Google Sheets mirror status for Airline Accounts.
-- Supabase remains authoritative; this table only records backup-sync state.
create table if not exists public.airline_ledger_google_sync (
  id smallint primary key default 1 check (id = 1),
  last_synced_revision bigint,
  last_synced_at timestamptz,
  status text not null default 'not_configured',
  error_message text
);

insert into public.airline_ledger_google_sync (id, status)
values (1, 'not_configured')
on conflict (id) do nothing;

alter table public.airline_ledger_google_sync enable row level security;
revoke all on public.airline_ledger_google_sync from anon, authenticated;
grant select, insert, update on public.airline_ledger_google_sync to service_role;
