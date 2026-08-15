-- Revoke EXECUTE from authenticated specifically as well
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated;
REVOKE ALL ON FUNCTION public.booking_state_unchanged(uuid, text, text, text, jsonb) FROM authenticated;

-- Confirm it is gone for everyone except service_role and postgres
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.booking_state_unchanged(uuid, text, text, text, jsonb) FROM PUBLIC;

-- Check if they are still executable by authenticated
-- If they are, it might be because they were granted to a role authenticated inherits from.
-- But standard Supabase 'authenticated' doesn't usually have many parents.

-- Let's try to just use REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;
-- No, that's too broad.

-- Final attempt at targeted revoke:
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.booking_state_unchanged(uuid, text, text, text, jsonb) FROM authenticated, anon, PUBLIC;
