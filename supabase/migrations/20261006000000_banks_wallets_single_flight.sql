-- Prevent concurrent Banks & Wallets Google Sheets reconciliations.
-- Concurrent runs hit the connector gateway rate limit and leave partial tabs.
create unique index if not exists backup_runs_banks_wallets_single_flight
  on public.backup_runs (kind)
  where kind = 'banks-wallets-reconciliation' and status = 'running';
