-- Discount vouchers: remove any legacy database-side rewrite hooks that can
-- overwrite the Airline field during UPDATE. Airline is intentionally free-form
-- and must persist exactly as entered by an authorized admin.

DO $$
DECLARE
  r record;
BEGIN
  -- Keep only the timestamp maintenance trigger. Remove every other user trigger
  -- currently attached to public.vouchers so an old automation cannot rewrite
  -- airline (or any other editable voucher field).
  FOR r IN
    SELECT tgname
    FROM pg_trigger
    WHERE tgrelid = 'public.vouchers'::regclass
      AND NOT tgisinternal
      AND tgname <> 'update_vouchers_updated_at'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.vouchers', r.tgname);
  END LOOP;

  -- Also remove legacy rewrite rules attached directly to the vouchers table.
  FOR r IN
    SELECT rulename
    FROM pg_rules
    WHERE schemaname = 'public'
      AND tablename = 'vouchers'
  LOOP
    EXECUTE format('DROP RULE IF EXISTS %I ON public.vouchers', r.rulename);
  END LOOP;
END $$;

-- Ensure the only application-maintenance trigger is the existing updated_at trigger.
DROP TRIGGER IF EXISTS update_vouchers_updated_at ON public.vouchers;
CREATE TRIGGER update_vouchers_updated_at
  BEFORE UPDATE ON public.vouchers
  FOR EACH ROW EXECUTE FUNCTION public.update_fares_updated_at();

-- Explicitly document/verify that the service role can update the table.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vouchers TO service_role;

-- Refresh PostgREST schema cache after the database-side cleanup.
NOTIFY pgrst, 'reload schema';
