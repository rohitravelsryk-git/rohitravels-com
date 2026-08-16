ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS mfa_enabled boolean DEFAULT false;
GRANT SELECT, UPDATE ON public.agents TO authenticated;
GRANT ALL ON public.agents TO service_role;
