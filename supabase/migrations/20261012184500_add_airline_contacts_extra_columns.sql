-- Migration: 20261012184500_add_airline_contacts_extra_columns.sql
-- Description: Adds Contact Person, Top UP Email, OTB Email, Bank Name, Account Title, and IBAN columns to public.airline_contacts.

-- 1. Create table if not exists
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

-- 2. Add new columns safely if they do not exist
ALTER TABLE public.airline_contacts ADD COLUMN IF NOT EXISTS contact_person TEXT NOT NULL DEFAULT '';
ALTER TABLE public.airline_contacts ADD COLUMN IF NOT EXISTS topup_email TEXT NOT NULL DEFAULT '';
ALTER TABLE public.airline_contacts ADD COLUMN IF NOT EXISTS otb_email TEXT NOT NULL DEFAULT '';
ALTER TABLE public.airline_contacts ADD COLUMN IF NOT EXISTS bank_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.airline_contacts ADD COLUMN IF NOT EXISTS account_title TEXT NOT NULL DEFAULT '';
ALTER TABLE public.airline_contacts ADD COLUMN IF NOT EXISTS iban TEXT NOT NULL DEFAULT '';

-- 3. Ensure indexes
CREATE INDEX IF NOT EXISTS idx_airline_contacts_sort ON public.airline_contacts (sort_order, airline_name);
CREATE INDEX IF NOT EXISTS idx_airline_contacts_active ON public.airline_contacts (is_active);

-- 4. Enable and force RLS
ALTER TABLE public.airline_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.airline_contacts FORCE ROW LEVEL SECURITY;

-- 5. Revoke public/anon access
REVOKE ALL ON public.airline_contacts FROM PUBLIC;
REVOKE ALL ON public.airline_contacts FROM anon;

-- 6. Permissions
GRANT ALL ON public.airline_contacts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.airline_contacts TO authenticated;

-- 7. Policies
DROP POLICY IF EXISTS "Public read airline_contacts" ON public.airline_contacts;
DROP POLICY IF EXISTS "airline_contacts_public_read" ON public.airline_contacts;
DROP POLICY IF EXISTS "airline_contacts_admin_all" ON public.airline_contacts;
DROP POLICY IF EXISTS "Service role manage airline_contacts" ON public.airline_contacts;

CREATE POLICY "airline_contacts_admin_all" ON public.airline_contacts
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Service role manage airline_contacts" ON public.airline_contacts
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- 8. Notify PostgREST cache reload
NOTIFY pgrst, 'reload schema';
