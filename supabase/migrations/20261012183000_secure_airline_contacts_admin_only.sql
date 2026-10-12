-- Migration: 20261012183000_secure_airline_contacts_admin_only.sql
-- Description: Strictly enforce admin-only access on public.airline_contacts and revoke all public/anonymous access.

-- 1. Ensure RLS is enabled and forced
ALTER TABLE IF EXISTS public.airline_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.airline_contacts FORCE ROW LEVEL SECURITY;

-- 2. Revoke all permissions from anon and public
REVOKE ALL ON public.airline_contacts FROM PUBLIC;
REVOKE ALL ON public.airline_contacts FROM anon;

-- 3. Drop any permissive or public policies
DROP POLICY IF EXISTS "Public read airline_contacts" ON public.airline_contacts;
DROP POLICY IF EXISTS "airline_contacts_public_read" ON public.airline_contacts;
DROP POLICY IF EXISTS "airline_contacts_admin_all" ON public.airline_contacts;
DROP POLICY IF EXISTS "Service role manage airline_contacts" ON public.airline_contacts;

-- 4. Grant table privileges strictly to service_role and authenticated users
GRANT ALL ON public.airline_contacts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.airline_contacts TO authenticated;

-- 5. Create strict admin-only policy for authenticated users
CREATE POLICY "airline_contacts_admin_all" ON public.airline_contacts
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 6. Allow service_role full management (for backend functions & server-side sync)
CREATE POLICY "Service role manage airline_contacts" ON public.airline_contacts
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- Notify PostgREST cache reload
NOTIFY pgrst, 'reload schema';
