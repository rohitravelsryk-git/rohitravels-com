CREATE TABLE IF NOT EXISTS public.b2b_sticky_notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    content text NOT NULL DEFAULT '',
    is_enabled boolean NOT NULL DEFAULT true,
    updated_at timestamptz DEFAULT now()
);

GRANT SELECT ON public.b2b_sticky_notes TO anon, authenticated;
GRANT ALL ON public.b2b_sticky_notes TO service_role;

ALTER TABLE public.b2b_sticky_notes ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'b2b_sticky_notes' AND policyname = 'Public read access'
    ) THEN
        CREATE POLICY "Public read access" ON public.b2b_sticky_notes FOR SELECT USING (true);
    END IF;
END $$;