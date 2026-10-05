ALTER TABLE public.accounts_book_services ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE public.accounts_book_accounts ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
NOTIFY pgrst, 'reload schema';