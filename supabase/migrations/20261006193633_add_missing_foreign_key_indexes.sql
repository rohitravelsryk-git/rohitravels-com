create index if not exists accounts_book_transactions_created_by_idx
  on public.accounts_book_transactions (created_by);

create index if not exists agent_bookings_agent_user_id_idx
  on public.agent_bookings (agent_user_id);

create index if not exists backup_errors_run_id_idx
  on public.backup_errors (run_id);

create index if not exists vendor_ledger_vendor_id_idx
  on public.vendor_ledger (vendor_id);
