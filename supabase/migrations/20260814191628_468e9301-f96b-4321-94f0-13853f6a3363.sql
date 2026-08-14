ALTER TABLE public.group_tickets ADD COLUMN IF NOT EXISTS fare_id uuid REFERENCES public.fares(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS group_tickets_fare_id_idx ON public.group_tickets(fare_id);

GRANT ALL ON public.group_tickets TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_tickets TO authenticated;
GRANT SELECT ON public.group_tickets TO anon;
