-- /admin/accounts-book reported "permission denied for table
-- accounts_book_accounts". Idempotent re-assert of the privileges the Accounts
-- Book server functions need, followed by an API schema-cache reload (the same
-- pair of steps that just fixed the Calculators page).
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'accounts_book_accounts',
    'accounts_book_transactions',
    'accounts_book_services'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('GRANT ALL ON public.%I TO service_role;', t);
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
