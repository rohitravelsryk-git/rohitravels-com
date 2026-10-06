-- Clarify the intentional separation between booking-catalog airlines and real airline ledger accounts.
-- public.airlines: addon/master-list catalog only; used for dropdowns and booking data.
-- public.airline_ledger_airlines: real accounting accounts only; opening balances and ledger transactions.
-- These datasets must never be auto-synced, copied, or treated as interchangeable.
comment on table public.airlines is
  'Booking/catalog airline master list only. Used for dropdowns and booking-related selections. Not an accounting ledger.';
comment on table public.airline_ledger_airlines is
  'Real airline accounting accounts only. Source of truth for Airline Accounts balances and ledger data. Intentionally separate from public.airlines.';
comment on table public.airline_ledger_transactions is
  'Real airline accounting transactions. Belong only to public.airline_ledger_airlines and drive live account balances.';
