-- Comprehensive Security Hardening Migration

-- 1. Table Grants & RLS for missing tables
-- admin_credentials
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admin_credentials' AND policyname = 'service_role_all_admin_credentials') THEN
        CREATE POLICY "service_role_all_admin_credentials" ON public.admin_credentials FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
END $$;

-- admin_password_resets
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admin_password_resets' AND policyname = 'service_role_all_admin_password_resets') THEN
        CREATE POLICY "service_role_all_admin_password_resets" ON public.admin_password_resets FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 2. Function Hardening (search_path & Execute Permissions)

-- has_role
ALTER FUNCTION public.has_role(uuid, public.app_role) SET search_path = public;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;

-- booking_state_unchanged
ALTER FUNCTION public.booking_state_unchanged(uuid, text, text, text, jsonb) SET search_path = public;
REVOKE ALL ON FUNCTION public.booking_state_unchanged(uuid, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.booking_state_unchanged(uuid, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.booking_state_unchanged(uuid, text, text, text, jsonb) TO service_role;

-- backup_touch_updated_at (Trigger Function)
ALTER FUNCTION public.backup_touch_updated_at() SET search_path = public;
REVOKE ALL ON FUNCTION public.backup_touch_updated_at() FROM PUBLIC;

-- prevent_agent_status_self_update (Trigger Function)
-- Already fixed in previous turn, but ensuring consistency
ALTER FUNCTION public.prevent_agent_status_self_update() SET search_path = public;
REVOKE ALL ON FUNCTION public.prevent_agent_status_self_update() FROM PUBLIC;

-- prevent_booking_status_self_update (Trigger Function)
-- Already fixed in previous turn, but ensuring consistency
ALTER FUNCTION public.prevent_booking_status_self_update() SET search_path = public;
REVOKE ALL ON FUNCTION public.prevent_booking_status_self_update() FROM PUBLIC;

-- set_agent_booking_ref (Trigger Function)
-- Already fixed in previous turn, but ensuring consistency
ALTER FUNCTION public.set_agent_booking_ref() SET search_path = public;
REVOKE ALL ON FUNCTION public.set_agent_booking_ref() FROM PUBLIC;

-- admin_reset_dataset
-- Already fixed but ensures permissions
REVOKE ALL ON FUNCTION public.admin_reset_dataset(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reset_dataset(text) TO service_role;

-- backup functions (backup_list_tables, backup_fetch_rows, backup_count_rows)
-- These were already revoked/granted correctly in their original migration 
-- but we ensure search_path is solid.
ALTER FUNCTION public.backup_list_tables() SET search_path = public;
ALTER FUNCTION public.backup_fetch_rows(text, timestamptz, integer, integer) SET search_path = public;
ALTER FUNCTION public.backup_count_rows(text) SET search_path = public;
