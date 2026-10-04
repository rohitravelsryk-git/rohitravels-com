-- Prevent concurrent saves from creating duplicate logical Accounts Book projections.
-- Legacy rows with NULL source_key remain untouched.
create unique index if not exists accounts_book_transactions_source_key_uidx
  on public.accounts_book_transactions (source_key)
  where source_key is not null;
