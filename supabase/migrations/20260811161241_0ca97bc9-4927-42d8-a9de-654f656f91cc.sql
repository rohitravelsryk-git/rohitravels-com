-- Final Security Clean-up

-- 1. Fix missing search_path and Revoke Execute for remaining functions

-- update_vendors_updated_at
ALTER FUNCTION public.update_vendors_updated_at() SET search_path = public;
REVOKE ALL ON FUNCTION public.update_vendors_updated_at() FROM PUBLIC;

-- update_queries_updated_at
ALTER FUNCTION public.update_queries_updated_at() SET search_path = public;
REVOKE ALL ON FUNCTION public.update_queries_updated_at() FROM PUBLIC;

-- backup_touch_updated_at (Already fixed search_path, adding REVOKE)
REVOKE ALL ON FUNCTION public.backup_touch_updated_at() FROM PUBLIC;

-- update_fares_updated_at (Already has search_path, adding REVOKE)
REVOKE ALL ON FUNCTION public.update_fares_updated_at() FROM PUBLIC;

-- set_updated_at (Already has search_path, adding REVOKE)
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC;

-- 2. Verify RLS for all tables in public schema
-- fares is public-readable (anon/authenticated)
-- vendors, queries, vouchers should be service_role or admin-only based on usage.
-- Let's ensure basic RLS policies for them if they only have service_role grants.

-- vendors
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vendors' AND policyname = 'service_role_all_vendors') THEN
        CREATE POLICY "service_role_all_vendors" ON public.vendors FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
END $$;

-- queries
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'queries' AND policyname = 'service_role_all_queries') THEN
        CREATE POLICY "service_role_all_queries" ON public.queries FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
END $$;

-- vouchers
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vouchers' AND policyname = 'service_role_all_vouchers') THEN
        CREATE POLICY "service_role_all_vouchers" ON public.vouchers FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
END $$;

-- inquiry_services
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'inquiry_services' AND policyname = 'service_role_all_inquiry_services') THEN
        CREATE POLICY "service_role_all_inquiry_services" ON public.inquiry_services FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
END $$;

-- site_settings
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'site_settings' AND policyname = 'service_role_all_site_settings') THEN
        CREATE POLICY "service_role_all_site_settings" ON public.site_settings FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
END $$;

-- visa_verification_links
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'visa_verification_links' AND policyname = 'service_role_all_visa_verification_links') THEN
        CREATE POLICY "service_role_all_visa_verification_links" ON public.visa_verification_links FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 3. Explicitly revoke execute on functions from authenticated unless needed
-- has_role and booking_state_unchanged are the ONLY ones that should be callable by authenticated.
-- All others should be service_role only.

REVOKE ALL ON FUNCTION public.set_agent_booking_ref() FROM authenticated;
REVOKE ALL ON FUNCTION public.prevent_agent_status_self_update() FROM authenticated;
REVOKE ALL ON FUNCTION public.prevent_booking_status_self_update() FROM authenticated;
REVOKE ALL ON FUNCTION public.backup_list_tables() FROM authenticated;
REVOKE ALL ON FUNCTION public.backup_fetch_rows(text, timestamptz, integer, integer) FROM authenticated;
REVOKE ALL ON FUNCTION public.backup_count_rows(text) FROM authenticated;
REVOKE ALL ON FUNCTION public.admin_reset_dataset(text) FROM authenticated;
