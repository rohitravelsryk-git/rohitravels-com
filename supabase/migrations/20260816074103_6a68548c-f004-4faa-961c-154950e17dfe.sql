-- 1. has_role
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- 2. booking_state_unchanged
REVOKE ALL ON FUNCTION public.booking_state_unchanged(uuid, text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.booking_state_unchanged(uuid, text, text, text, jsonb) TO authenticated, service_role;

-- 3. Trigger and admin-only functions
REVOKE ALL ON FUNCTION public.prevent_agent_status_self_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_booking_status_self_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.backup_touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_reset_dataset(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.backup_list_tables() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.backup_fetch_rows(text, timestamptz, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.backup_count_rows(text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.prevent_agent_status_self_update() TO service_role;
GRANT EXECUTE ON FUNCTION public.prevent_booking_status_self_update() TO service_role;
GRANT EXECUTE ON FUNCTION public.backup_touch_updated_at() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_reset_dataset(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.backup_list_tables() TO service_role;
GRANT EXECUTE ON FUNCTION public.backup_fetch_rows(text, timestamptz, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.backup_count_rows(text) TO service_role;

-- Optional function if exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'update_fares_updated_at') THEN
        REVOKE ALL ON FUNCTION public.update_fares_updated_at() FROM PUBLIC, anon, authenticated;
        GRANT EXECUTE ON FUNCTION public.update_fares_updated_at() TO service_role;
    END IF;
END $$;
