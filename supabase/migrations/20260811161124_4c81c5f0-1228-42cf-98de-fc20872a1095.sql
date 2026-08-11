-- Fix search_path and Revoke Public Execute for security functions

-- 1. Fix set_agent_booking_ref (Trigger Function)
ALTER FUNCTION public.set_agent_booking_ref() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.set_agent_booking_ref() FROM PUBLIC;

-- 2. Fix prevent_agent_status_self_update (Trigger Function)
ALTER FUNCTION public.prevent_agent_status_self_update() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.prevent_agent_status_self_update() FROM PUBLIC;

-- 3. Fix prevent_booking_status_self_update (Trigger Function)
ALTER FUNCTION public.prevent_booking_status_self_update() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.prevent_booking_status_self_update() FROM PUBLIC;

-- 4. Fix booking_state_unchanged (Helper Function)
-- Already has SET search_path = public
REVOKE EXECUTE ON FUNCTION public.booking_state_unchanged(uuid, text, text, text, jsonb) FROM PUBLIC;
-- It's used in RLS policies, so 'authenticated' still needs access (already granted in original migration)

-- 5. Fix admin_reset_dataset (Service Function)
-- Already has SET search_path = public and revokes. Double check grants.
GRANT EXECUTE ON FUNCTION public.admin_reset_dataset(text) TO service_role;

-- 6. Fix any missing RLS policies for newly created tables (if any)
-- login_otps
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'login_otps' AND policyname = 'service_role_all_login_otps'
    ) THEN
        CREATE POLICY "service_role_all_login_otps" ON public.login_otps FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
END $$;

-- self_group_passengers
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'self_group_passengers' AND policyname = 'service_role_all_self_group_passengers'
    ) THEN
        CREATE POLICY "service_role_all_self_group_passengers" ON public.self_group_passengers FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 7. Ensure RLS on self_group_applications
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'self_group_applications' AND policyname = 'service_role_all_self_group_applications'
    ) THEN
        CREATE POLICY "service_role_all_self_group_applications" ON public.self_group_applications FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
END $$;
