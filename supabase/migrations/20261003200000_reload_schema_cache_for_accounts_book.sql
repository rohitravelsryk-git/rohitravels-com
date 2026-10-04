-- /admin/accounts-book returns "permission denied for table accounts_book_accounts"
-- even though the service role was granted full access in the original
-- 2026-09-10 migrations. Same class of issue already fixed for site_settings
-- (see 20261003190000): PostgREST's cached view of table grants/schema went
-- stale, so the live API layer is serving an old permission snapshot instead
-- of what the database actually grants.
--
-- Re-asserting the grants is harmless and idempotent; the reload notification
-- is what actually restores access without needing a manual dashboard action.

GRANT ALL ON public.accounts_book_accounts TO service_role;
GRANT ALL ON public.accounts_book_transactions TO service_role;

REVOKE ALL ON public.accounts_book_accounts FROM anon, authenticated;
REVOKE ALL ON public.accounts_book_transactions FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
