-- Revoke execute from public for all identified security definer functions
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.booking_state_unchanged(uuid, text, text, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.backup_fetch_rows(text, timestamp with time zone, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.backup_list_tables() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.backup_count_rows(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_reset_dataset(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prevent_agent_status_self_update() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prevent_booking_status_self_update() FROM PUBLIC;

-- Grant specifically to roles that need them
-- Application functions
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.booking_state_unchanged(uuid, text, text, text, jsonb) TO authenticated, service_role;

-- Admin/System functions (only service_role for backups/resets unless specifically needed by staff in app)
GRANT EXECUTE ON FUNCTION public.backup_fetch_rows(text, timestamp with time zone, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.backup_list_tables() TO service_role;
GRANT EXECUTE ON FUNCTION public.backup_count_rows(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_reset_dataset(text) TO service_role;

-- Trigger functions (usually executed as owner, but good to restrict execute permission anyway)
GRANT EXECUTE ON FUNCTION public.prevent_agent_status_self_update() TO service_role;
GRANT EXECUTE ON FUNCTION public.prevent_booking_status_self_update() TO service_role;