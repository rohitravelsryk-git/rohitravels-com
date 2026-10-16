-- Emergency de-risk for the database connection pool (2026-10-16).
--
-- After 20261016113000_airline_sheet_instant_sync.sql went live the database
-- stopped answering queries: every request timed out acquiring a connection
-- from the pool, which blocks the whole app. The sync token was never
-- configured (AIRLINE_SYNC_HOOK_TOKEN / vault 'airline_sheet_sync_token'),
-- so the trigger-fired webhook could never succeed anyway, while:
--   * the pg_cron catch-up POSTed the (then unauthenticated, 503) webhook
--     every minute regardless of any ledger activity, and
--   * each statement-level trigger read vault.decrypted_secrets and updated
--     the singleton queue row inside every ledger write transaction,
--     serialising concurrent saves on one row.
--
-- This migration removes the always-on database-side sync work. Nothing is
-- lost for users: the application-level sync (after each save and on page
-- open) continues to mirror the Google Sheet exactly as before.
--
-- Re-enabling later (only once the database is confirmed stable AND the
-- token secrets are configured on both sides): re-apply the trigger and
-- cron sections of 20261016113000_airline_sheet_instant_sync.sql. The queue
-- table and notify function are intentionally kept for that.

do $$
begin
  if to_regproc('cron.unschedule') is not null then
    perform cron.unschedule('airline-sheet-sync-catchup');
  end if;
exception when others then
  null; -- cron may not be present; nothing else to do here
end $$;

drop trigger if exists airline_sheet_sync_transactions on public.airline_ledger_transactions;
drop trigger if exists airline_sheet_sync_airlines on public.airline_ledger_airlines;
drop trigger if exists airline_sheet_sync_agents on public.airline_ledger_agents;
