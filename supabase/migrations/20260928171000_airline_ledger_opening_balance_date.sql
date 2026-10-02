-- Keep an explicit date for every airline opening balance.
alter table public.airline_ledger_airlines
  add column if not exists opening_balance_date date not null default current_date;

-- Ensure existing airline rows have a usable opening-balance date.
update public.airline_ledger_airlines
set opening_balance_date = current_date
where opening_balance_date is null;
