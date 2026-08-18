-- Add columns for second origin and destination
ALTER TABLE public.fares ADD COLUMN IF NOT EXISTS origin2 text;
ALTER TABLE public.fares ADD COLUMN IF NOT EXISTS origin2_code text;
ALTER TABLE public.fares ADD COLUMN IF NOT EXISTS destination2 text;
ALTER TABLE public.fares ADD COLUMN IF NOT EXISTS destination2_code text;

-- Grant access to these new columns (already granted at table level but just to be sure)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fares TO authenticated;
GRANT SELECT ON public.fares TO anon;
GRANT ALL ON public.fares TO service_role;
