-- Migration: 20261009200000_create_services_table.sql
-- Description: Adds photo_url and description to inquiry_services and provisions public.services table.

-- 1. Enhance inquiry_services with photo_url and description
ALTER TABLE public.inquiry_services
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT;

-- 2. Create standalone public.services table for comprehensive services catalog
CREATE TABLE IF NOT EXISTS public.services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    label TEXT,
    photo_url TEXT,
    description TEXT,
    sort_order INTEGER DEFAULT 100,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- 4. Policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'services' AND policyname = 'Public read services'
    ) THEN
        CREATE POLICY "Public read services" ON public.services FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'services' AND policyname = 'Service role manage services'
    ) THEN
        CREATE POLICY "Service role manage services" ON public.services FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 5. Seed initial services if table is empty
INSERT INTO public.services (name, label, photo_url, description, sort_order)
VALUES
    ('Group Fares', 'Group Fares', 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=800&q=80', 'Exclusive group flight tickets and bulk seat allocations with guaranteed competitive wholesale pricing.', 10),
    ('Umrah Package', 'Umrah Package', 'https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa?auto=format&fit=crop&w=1920&q=80', 'Complete spiritual journey packages including visa processing, Makkah & Madinah hotel accommodation, and ground transfers.', 20),
    ('Ticket Booking', 'Ticket Booking', 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80', 'Domestic and international flight reservations across all major scheduled and budget airlines worldwide.', 40),
    ('Visa Services', 'Visa Services', 'https://images.unsplash.com/photo-1569503689347-cddac6ba64f5?auto=format&fit=crop&w=800&q=80', 'Expert visa consultancy, documentation, embassy appointments, and verification for Saudi Arabia, UAE, Oman, and worldwide.', 50),
    ('Hotel Booking', 'Hotel Booking', 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80', 'Budget to luxury accommodation booking near key landmarks, Haram Sharif, and international business hubs.', 60),
    ('OK TO BOARD', 'OK TO BOARD', 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=800&q=80', 'Fast OTB verification and airline system update for hassle-free departure to Gulf countries.', 70),
    ('Discount Vouchers', 'Discount Vouchers', 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=800&q=80', 'Special travel vouchers, agency perks, and seasonal promotional discounts for corporate and retail clients.', 80),
    ('Other', 'Other', 'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?auto=format&fit=crop&w=800&q=80', 'Customized travel solutions, travel insurance, urgent inquiries, and bespoke itineraries.', 999)
ON CONFLICT DO NOTHING;

-- 6. Also backfill inquiry_services default photos and descriptions if empty
UPDATE public.inquiry_services
SET 
  photo_url = CASE 
    WHEN LOWER(label) = 'group fares' THEN 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=800&q=80'
    WHEN LOWER(label) = 'umrah package' THEN 'https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa?auto=format&fit=crop&w=1920&q=80'
    WHEN LOWER(label) = 'ticket booking' THEN 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80'
    WHEN LOWER(label) = 'visa services' THEN 'https://images.unsplash.com/photo-1569503689347-cddac6ba64f5?auto=format&fit=crop&w=800&q=80'
    WHEN LOWER(label) = 'hotel booking' THEN 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80'
    WHEN LOWER(label) = 'ok to board' THEN 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=800&q=80'
    WHEN LOWER(label) = 'discount vouchers' THEN 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=800&q=80'
    ELSE 'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?auto=format&fit=crop&w=800&q=80'
  END,
  description = CASE 
    WHEN LOWER(label) = 'group fares' THEN 'Exclusive group flight tickets and bulk seat allocations with guaranteed competitive wholesale pricing.'
    WHEN LOWER(label) = 'umrah package' THEN 'Complete spiritual journey packages including visa processing, Makkah & Madinah hotel accommodation, and ground transfers.'
    WHEN LOWER(label) = 'ticket booking' THEN 'Domestic and international flight reservations across all major scheduled and budget airlines worldwide.'
    WHEN LOWER(label) = 'visa services' THEN 'Expert visa consultancy, documentation, embassy appointments, and verification for Saudi Arabia, UAE, Oman, and worldwide.'
    WHEN LOWER(label) = 'hotel booking' THEN 'Budget to luxury accommodation booking near key landmarks, Haram Sharif, and international business hubs.'
    WHEN LOWER(label) = 'ok to board' THEN 'Fast OTB verification and airline system update for hassle-free departure to Gulf countries.'
    WHEN LOWER(label) = 'discount vouchers' THEN 'Special travel vouchers, agency perks, and seasonal promotional discounts for corporate and retail clients.'
    ELSE 'Customized travel solutions, travel insurance, urgent inquiries, and bespoke itineraries.'
  END
WHERE photo_url IS NULL OR description IS NULL;

-- 7. Notify PostgREST cache reload
NOTIFY pgrst, 'reload schema';
