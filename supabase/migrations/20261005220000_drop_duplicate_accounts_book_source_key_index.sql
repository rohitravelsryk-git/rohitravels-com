-- Keep the canonical source-key unique guard and remove the duplicate legacy index.
drop index if exists public.accounts_book_transactions_source_key_unique;
