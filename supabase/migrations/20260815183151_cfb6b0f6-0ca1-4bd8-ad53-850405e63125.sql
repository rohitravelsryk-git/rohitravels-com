-- Fix for linter issue: Revoke PUBLIC access to sensitive SECURITY DEFINER functions

-- 1. has_role
-- Revoke default PUBLIC execute privilege
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
-- Explicitly grant only to authenticated and service_role
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- 2. booking_state_unchanged
-- Revoke all permissions from PUBLIC to ensure security
REVOKE ALL ON FUNCTION public.booking_state_unchanged(uuid, text, text, text, jsonb) FROM PUBLIC;
-- Grant execute back to authenticated and service_role
GRANT EXECUTE ON FUNCTION public.booking_state_unchanged(uuid, text, text, text, jsonb) TO authenticated, service_role;
