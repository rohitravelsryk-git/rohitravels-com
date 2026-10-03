-- The public Calculators page returns HTTP 500 with PostgREST's
-- "Could not find the table 'public.site_settings' in the schema cache", while the
-- table itself exists (created 2026-07-26). That is a stale API schema cache, not
-- missing data: every setting held in site_settings (fare markup/PSF, announcement,
-- banner, calculator copy, admin menu) silently falls back to defaults in the code
-- paths that swallow the error, and hard-fails in the ones that do not.
--
-- Re-asserting grants is harmless and idempotent; the reload notification is what
-- restores reads.
GRANT SELECT ON public.site_settings TO anon, authenticated;
GRANT ALL ON public.site_settings TO service_role;

NOTIFY pgrst, 'reload schema';
