-- 1. Switch non-critical functions to SECURITY INVOKER
-- These don't need elevated privileges to perform their checks.
ALTER FUNCTION public.has_role(uuid, public.app_role) SECURITY INVOKER;
ALTER FUNCTION public.booking_state_unchanged(uuid, text, text, text, jsonb) SECURITY INVOKER;

-- 2. For remaining SECURITY DEFINER functions, explicitly revoke EXECUTE from PUBLIC
-- and grant ONLY to service_role (or authenticated if absolutely necessary).
REVOKE ALL ON FUNCTION public.backup_fetch_rows(text, timestamp with time zone, integer, integer) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.backup_fetch_rows(text, timestamp with time zone, integer, integer) TO service_role;

REVOKE ALL ON FUNCTION public.backup_list_tables() FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.backup_list_tables() TO service_role;

REVOKE ALL ON FUNCTION public.backup_count_rows(text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.backup_count_rows(text) TO service_role;

REVOKE ALL ON FUNCTION public.admin_reset_dataset(text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_dataset(text) TO service_role;

REVOKE ALL ON FUNCTION public.prevent_agent_status_self_update() FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.prevent_agent_status_self_update() TO service_role;

REVOKE ALL ON FUNCTION public.prevent_booking_status_self_update() FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.prevent_booking_status_self_update() TO service_role;