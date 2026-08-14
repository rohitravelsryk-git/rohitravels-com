ALTER TABLE public.self_group_passengers ADD COLUMN IF NOT EXISTS status text DEFAULT 'BOOKED';
GRANT ALL ON public.self_group_passengers TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.self_group_passengers TO authenticated;
GRANT SELECT ON public.self_group_passengers TO anon;
