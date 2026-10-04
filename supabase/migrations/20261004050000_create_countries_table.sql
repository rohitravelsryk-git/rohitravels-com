-- Create countries table in public schema for Addons & Visa links
CREATE TABLE IF NOT EXISTS public.countries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    code TEXT,
    sort_order INTEGER DEFAULT 100,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Public read countries" ON public.countries
    FOR SELECT
    USING (true);

-- Allow service_role full management
CREATE POLICY "Service role manage countries" ON public.countries
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Seed initial countries
INSERT INTO public.countries (name, code, sort_order)
VALUES
    ('Bahrain', 'BH', 1),
    ('Kuwait', 'KW', 2),
    ('Oman', 'OM', 3),
    ('Qatar', 'QA', 4),
    ('Saudi Arabia', 'SA', 5),
    ('Turkey', 'TR', 6),
    ('United Arab Emirates', 'AE', 7)
ON CONFLICT (name) DO NOTHING;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
