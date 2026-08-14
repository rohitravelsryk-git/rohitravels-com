ALTER TABLE public.fares ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false;
ALTER TABLE public.fares ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Grant access (though service_role usually has it, it's good practice)
GRANT ALL ON public.fares TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fares TO authenticated;
GRANT SELECT ON public.fares TO anon;
