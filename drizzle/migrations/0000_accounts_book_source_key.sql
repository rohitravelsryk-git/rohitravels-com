ALTER TABLE public.accounts_book_transactions ADD COLUMN IF NOT EXISTS source_key text;
CREATE UNIQUE INDEX IF NOT EXISTS accounts_book_transactions_source_key_uidx ON public.accounts_book_transactions (source_key) WHERE source_key IS NOT NULL;
NOTIFY pgrst, 'reload schema';