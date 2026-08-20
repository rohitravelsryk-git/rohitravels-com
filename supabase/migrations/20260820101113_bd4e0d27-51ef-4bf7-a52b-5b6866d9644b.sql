-- Revoke default execute from public
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.booking_state_unchanged(uuid, text, text, text, jsonb) FROM PUBLIC;

-- Grant to specific roles
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.booking_state_unchanged(uuid, text, text, text, jsonb) TO authenticated, service_role;