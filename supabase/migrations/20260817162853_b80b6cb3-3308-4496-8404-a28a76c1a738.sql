REVOKE ALL ON FUNCTION public.backup_list_tables() FROM PUBLIC, authenticated, anon;
REVOKE ALL ON FUNCTION public.backup_count_rows(text) FROM PUBLIC, authenticated, anon;
REVOKE ALL ON FUNCTION public.backup_fetch_rows(text, timestamp with time zone, integer, integer) FROM PUBLIC, authenticated, anon;
REVOKE ALL ON FUNCTION public.prevent_agent_status_self_update() FROM PUBLIC, authenticated, anon;
REVOKE ALL ON FUNCTION public.prevent_booking_status_self_update() FROM PUBLIC, authenticated, anon;
REVOKE ALL ON FUNCTION public.admin_reset_dataset(text) FROM PUBLIC, authenticated, anon;

-- Explicitly grant to service_role for internal/admin use
GRANT EXECUTE ON FUNCTION public.backup_list_tables() TO service_role;
GRANT EXECUTE ON FUNCTION public.backup_count_rows(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.backup_fetch_rows(text, timestamp with time zone, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.prevent_agent_status_self_update() TO service_role;
GRANT EXECUTE ON FUNCTION public.prevent_booking_status_self_update() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_reset_dataset(text) TO service_role;
