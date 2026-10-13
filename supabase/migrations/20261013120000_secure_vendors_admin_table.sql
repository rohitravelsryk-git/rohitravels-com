-- Migration: 20261013120000_secure_vendors_admin_table.sql
-- Description: Ensure public.vendors table exists with all columns, strict admin-only RLS, and verified live seed data.

-- 1. Ensure app_role enum type exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM ('admin');
    END IF;
END $$;

-- 2. Ensure user_roles table exists
CREATE TABLE IF NOT EXISTS public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role public.app_role NOT NULL DEFAULT 'admin'::public.app_role,
    UNIQUE (user_id, role)
);

-- 3. Ensure has_role function exists
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- 4. Create public.vendors table if not exists
CREATE TABLE IF NOT EXISTS public.vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'Airline / GDS',
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    city TEXT,
    opening_balance NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    current_balance NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure notes column exists in case table was created by older migration
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS notes TEXT;

-- 5. Create vendor_ledger table if not exists
CREATE TABLE IF NOT EXISTS public.vendor_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID REFERENCES public.vendors(id) ON DELETE CASCADE,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    reference_no TEXT,
    description TEXT,
    debit NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    credit NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    balance NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Ensure RLS is enabled and forced
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors FORCE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_ledger FORCE ROW LEVEL SECURITY;

-- 7. Revoke all permissions from anon and public
REVOKE ALL ON public.vendors FROM PUBLIC;
REVOKE ALL ON public.vendors FROM anon;
REVOKE ALL ON public.vendor_ledger FROM PUBLIC;
REVOKE ALL ON public.vendor_ledger FROM anon;

-- 8. Drop permissive legacy policies
DROP POLICY IF EXISTS "Allow read vendors" ON public.vendors;
DROP POLICY IF EXISTS "Allow write vendors" ON public.vendors;
DROP POLICY IF EXISTS "Allow read vendor_ledger" ON public.vendor_ledger;
DROP POLICY IF EXISTS "Allow write vendor_ledger" ON public.vendor_ledger;
DROP POLICY IF EXISTS "vendors_admin_all" ON public.vendors;
DROP POLICY IF EXISTS "vendors_service_role" ON public.vendors;
DROP POLICY IF EXISTS "vendor_ledger_admin_all" ON public.vendor_ledger;
DROP POLICY IF EXISTS "vendor_ledger_service_role" ON public.vendor_ledger;

-- 9. Grant table privileges to service_role and authenticated
GRANT ALL ON public.vendors TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendors TO authenticated;
GRANT ALL ON public.vendor_ledger TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_ledger TO authenticated;

-- 10. Admin policies for authenticated users
CREATE POLICY "vendors_admin_all" ON public.vendors
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "vendor_ledger_admin_all" ON public.vendor_ledger
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 11. Full management policies for service_role (server functions & background sync)
CREATE POLICY "vendors_service_role" ON public.vendors
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "vendor_ledger_service_role" ON public.vendor_ledger
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- 12. Seed initial vendor records matching live Google Sheet
INSERT INTO public.vendors (id, vendor_code, name, category, contact_person, phone, email, city, opening_balance, current_balance, is_active, notes)
VALUES 
  ('04ae79c7-5aab-442a-996b-dbad46ff49bf', 'VND-1001', 'Rohi Travels', 'Airline / GDS', 'Muhammad Irfan', '0300-9670463', 'rohitravels@gmail.com', 'Rahim Yar Khan', 0.00, 0.00, true, 'Official Partner'),
  ('11d6645f-dcd3-4dbc-beb1-1bc454c490d2', 'VND-1002', 'Madina Travels', 'Vendor', 'Waqas Aslam', '0302-3366762', 'madinatravels.ryk@gmail.com', 'Rahim Yar Khan', 0.00, 0.00, true, 'Direct Supplier')
ON CONFLICT (vendor_code) DO NOTHING;

-- 13. Notify schema reload
NOTIFY pgrst, 'reload schema';
