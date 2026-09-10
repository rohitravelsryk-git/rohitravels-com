-- Link Accounts Book source entries to their generated cash/bank ledger rows.
alter table public.accounts_book_transactions
  add column if not exists source_type text,
  add column if not exists source_id uuid;

create index if not exists accounts_book_transactions_source_idx
  on public.accounts_book_transactions(source_type, source_id);

-- Default bank and wallet ledgers from the Accounts Book prototype.
do $$
begin
  if not exists (select 1 from public.accounts_book_accounts where kind in ('bank', 'wallet')) then
    insert into public.accounts_book_accounts (name, kind, opening_balance)
    values
      ('UBL Personal', 'bank', 0),
      ('UBL Company', 'bank', 0),
      ('Meezan', 'bank', 0),
      ('HBL', 'bank', 0),
      ('ABL', 'bank', 0),
      ('BAH', 'bank', 0),
      ('JazzCash', 'wallet', 0),
      ('EasyPaisa', 'wallet', 0);
  end if;
end $$;
