-- Keep server-only operational and financial tables out of the public Data API.
-- Browser access is intentionally routed through authenticated server functions.
revoke all on table
  public.accounts_book_accounts,
  public.accounts_book_services,
  public.accounts_book_transaction_sync_jobs,
  public.accounts_book_transactions,
  public.admin_credentials,
  public.admin_password_resets,
  public.airline_ledger_airlines,
  public.airline_ledger_audit,
  public.airline_ledger_meta,
  public.airline_ledger_transactions,
  public.rohi_financial_backup_meta,
  public.rohi_financial_backup_sync
from anon, authenticated;

-- SECURITY DEFINER helpers must not be callable through public RPC endpoints.
revoke execute on function public.airline_ledger_touch_revision() from public, anon, authenticated;
revoke execute on function public.backup_count_rows(_table text) from public, anon, authenticated;
revoke execute on function public.backup_fetch_rows(_table text, _since timestamp with time zone, _limit integer, _offset integer) from public, anon, authenticated;
revoke execute on function public.backup_list_tables() from public, anon, authenticated;
revoke execute on function public.rohi_touch_financial_backup_revision() from public, anon, authenticated;

-- New public-schema objects remain private until a migration explicitly exposes them.
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated;
