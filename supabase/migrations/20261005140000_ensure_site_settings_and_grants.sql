-- Ensure site_settings exists with proper schema and grants
CREATE TABLE IF NOT EXISTS public.site_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'site_settings' AND policyname = 'Public read site_settings'
    ) THEN
        CREATE POLICY "Public read site_settings" ON public.site_settings FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'site_settings' AND policyname = 'Service role manage site_settings'
    ) THEN
        CREATE POLICY "Service role manage site_settings" ON public.site_settings FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
END $$;

GRANT SELECT ON public.site_settings TO anon, authenticated;
GRANT ALL ON public.site_settings TO service_role;

-- Seed default settings if empty
INSERT INTO public.site_settings (key, value)
VALUES
    ('psf', '{"amount": 1000}'::jsonb),
    ('announcement_banner', '{"enabled": false, "text": ""}'::jsonb),
    ('agent_registration_visible', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
