ALTER TABLE public.fares ADD COLUMN auto_hide_hours INTEGER DEFAULT 2;
-- Ensure GRANTs are consistent
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fares TO authenticated;
GRANT ALL ON public.fares TO service_role;
GRANT SELECT ON public.fares TO anon;
