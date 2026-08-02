REVOKE ALL ON FUNCTION public.booking_state_unchanged(uuid, text, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.booking_state_unchanged(uuid, text, text, text, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.booking_state_unchanged(uuid, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.booking_state_unchanged(uuid, text, text, text, jsonb) TO service_role;