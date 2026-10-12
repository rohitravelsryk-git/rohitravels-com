-- Migration: 20261012183000_secure_airline_contacts_admin_only.sql
-- Description: Strictly enforce admin-only access on public.airline_contacts and revoke all public/anonymous access.

-- 1. Ensure table exists first
CREATE TABLE IF NOT EXISTS public.airline_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    airline_name TEXT NOT NULL,
    contact_person TEXT NOT NULL DEFAULT '',
    contact_number TEXT NOT NULL DEFAULT '',
    sales_support TEXT NOT NULL DEFAULT '',
    topup_email TEXT NOT NULL DEFAULT '',
    otb_email TEXT NOT NULL DEFAULT '',
    bank_name TEXT NOT NULL DEFAULT '',
    account_title TEXT NOT NULL DEFAULT '',
    iban TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 100,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Ensure RLS is enabled and forced
ALTER TABLE public.airline_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.airline_contacts FORCE ROW LEVEL SECURITY;

-- 3. Revoke all permissions from anon and public
REVOKE ALL ON public.airline_contacts FROM PUBLIC;
REVOKE ALL ON public.airline_contacts FROM anon;

-- 4. Drop any permissive or public policies
DROP POLICY IF EXISTS "Public read airline_contacts" ON public.airline_contacts;
DROP POLICY IF EXISTS "airline_contacts_public_read" ON public.airline_contacts;
DROP POLICY IF EXISTS "airline_contacts_admin_all" ON public.airline_contacts;
DROP POLICY IF EXISTS "Service role manage airline_contacts" ON public.airline_contacts;

-- 5. Grant table privileges strictly to service_role and authenticated users
GRANT ALL ON public.airline_contacts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.airline_contacts TO authenticated;

-- 6. Create strict admin-only policy for authenticated users
CREATE POLICY "airline_contacts_admin_all" ON public.airline_contacts
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 7. Allow service_role full management (for backend functions & server-side sync)
CREATE POLICY "Service role manage airline_contacts" ON public.airline_contacts
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- 8. Notify PostgREST cache reload
NOTIFY pgrst, 'reload schema';
