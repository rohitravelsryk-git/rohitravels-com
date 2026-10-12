-- Migration: 20261012180000_create_airline_contacts_table.sql
-- Description: Creates public.airline_contacts with all operational fields, self-contained app_role & user_roles setup, strict admin RLS, and seed data.

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

-- 4. Create public.airline_contacts table with all 10 columns
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

-- 5. Add columns if table already existed without them
ALTER TABLE public.airline_contacts ADD COLUMN IF NOT EXISTS contact_person TEXT NOT NULL DEFAULT '';
ALTER TABLE public.airline_contacts ADD COLUMN IF NOT EXISTS topup_email TEXT NOT NULL DEFAULT '';
ALTER TABLE public.airline_contacts ADD COLUMN IF NOT EXISTS otb_email TEXT NOT NULL DEFAULT '';
ALTER TABLE public.airline_contacts ADD COLUMN IF NOT EXISTS bank_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.airline_contacts ADD COLUMN IF NOT EXISTS account_title TEXT NOT NULL DEFAULT '';
ALTER TABLE public.airline_contacts ADD COLUMN IF NOT EXISTS iban TEXT NOT NULL DEFAULT '';

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_airline_contacts_sort ON public.airline_contacts (sort_order, airline_name);
CREATE INDEX IF NOT EXISTS idx_airline_contacts_active ON public.airline_contacts (is_active);

-- 7. Strict Row Level Security
ALTER TABLE public.airline_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.airline_contacts FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.airline_contacts FROM PUBLIC;
REVOKE ALL ON public.airline_contacts FROM anon;

GRANT ALL ON public.airline_contacts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.airline_contacts TO authenticated;

DROP POLICY IF EXISTS "Public read airline_contacts" ON public.airline_contacts;
DROP POLICY IF EXISTS "airline_contacts_public_read" ON public.airline_contacts;
DROP POLICY IF EXISTS "airline_contacts_admin_all" ON public.airline_contacts;
DROP POLICY IF EXISTS "Service role manage airline_contacts" ON public.airline_contacts;

-- Service role bypass for backend server functions & sync
CREATE POLICY "Service role manage airline_contacts" ON public.airline_contacts
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- Admin-only policy for authenticated users
CREATE POLICY "airline_contacts_admin_all" ON public.airline_contacts
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 8. Seed 32 airline records
INSERT INTO public.airline_contacts (airline_name, contact_number, sales_support, address, sort_order)
VALUES
    ('PIA', '021-111-786-786', 'salessupport.khi@piac.aero', '', 10),
    ('AIR SIAL', '052-111-247-742', '', '', 20),
    ('SERENE', '111-737-363', 'salesupport@sereneair.com', '', 30),
    ('AIRBLUE', '021-111-247-258', '', '', 40),
    ('FLYJINNAH', '021-111-000-035, 021-38899502', 'trade@flyjinnah.com', '', 50),
    ('SAUDI AIRLINE', 'Reservation: +92-21-111-747-300 Sales Office: +92-21-35147703 / 35147704', 'slssupgrpkhi@saudia.com', '', 60),
    ('EMIRATES', '021-111-225-535', 'salessupportkhi@emirates.com', '', 70),
    ('FLYDUBAI', '051-111-225-539', 'support@flydubaipk.com', '', 80),
    ('GULF AIR', '021-35675232, 021 35654483', 'khi.salessupport@gulfair.com', '', 90),
    ('OMAN AIR', '021-35693979-80', 'khi.ctostaff@omanair.com', '', 100),
    ('ETIHAD', '051-8109092 , 08-0090044385 INTERNATIONAL NUMBER', 'pakssupport@etihad.ae, ccdocs@etihad.ae', '', 110),
    ('QATAR', 'Call CENTRE now 24/7 +92 21 38790002', 'khireservation@pk.qatarairways.com', '', 120),
    ('SRILANKAN', '021-35224437-38 , 0321-8209313', 'ul_khiressup@srilankan.com, khireservations@srilankan.com, ul_khislsmgr@srilankan.com', '', 130),
    ('THAI', '021-34320270-75', 'khisalesthaiairways@gmail.com', 'Office # A-305, 3rd Floor, Fortune Tower, Shahrah-e-Faisal Road.', 140),
    ('TURKISH', 'Call Center: PK: 00 800 900 33020 | UK: 0844 800 66 66 | USA: 1-800-874-8875', 'KHISALES@thy.com, KHICUSTOMER@THY.COM', 'Showroom 106, The Residence, Khaliq-uz-Zaman Road, Clifton Block-8, Karachi - Pakistan', 150),
    ('PEGASUS', '021-35655374-75', 'pegasuspk@gerrys.com.pk', '', 160),
    ('JAZEERA', '021-35693816, 021-35693817', 'j9khi.tro@gerrys.com.pk, j9khi.tro2@gerrys.com.pk', '', 170),
    ('HAHN AIR', '', '', '', 180),
    ('KENYA', '', 'kqkhi@gerrys.com.pk', '', 190),
    ('ETHOPIAN', '(021) 35632418 , +92 300 2663220 (MANSOOR ALI)', 'reservations.et@bukharigroup.com.pk', '', 200),
    ('MALINDO', '021-35684012,13,14,16,17,18 (03000341448) 03268088700', '', '', 210),
    ('AIR CHINA', '0092 333 2220054 (MR. SAAD)', '', '', 220),
    ('MK/QF', '', '', '', 230),
    ('AZERBAIJAN', '', '', '', 240),
    ('RAWAND AIR', '', '', '', 250),
    ('AIR ARABIA', '(+92 21) 35650967 / 68 / 69', '', 'Opposite Aisha Bawany Academy, Shara E Faisal Karachi', 260),
    ('SALAM AIR', '021-35634447 021-35634448.', 'sales.khi@salamair.com', 'kashif Centre Sharae Faisal Karachi', 270),
    ('FLYNAS', '021-111552111', '', '', 280),
    ('CATHAY', '', 'parvez_naqvi@cathaypacific.com, jalees_nawaz@cathaypacific.com', '', 290),
    ('FLYADEAL', '0370-3495558', '', '', 300),
    ('AIRASIA', '0300-2663220 (Syed Mansoor Counter Supervisor), 0345-6000701 (Spo Adnan)', 'sales@tcb.com.pk', 'KHI METRO POLE', 310),
    ('UZBEK AIRWAYS', '021-35641050, 021-35641052, 0345-2167202 SHAHZAD JAFRI', '', 'KHI METRO POLE', 320)
ON CONFLICT DO NOTHING;

-- 9. Reload schema cache
NOTIFY pgrst, 'reload schema';
