ALTER TABLE public.fares ADD COLUMN hide_fare_after_2h BOOLEAN DEFAULT TRUE;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fares TO authenticated;
GRANT ALL ON public.fares TO service_role;
GRANT SELECT ON public.fares TO anon;
