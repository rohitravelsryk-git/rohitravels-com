DROP POLICY IF EXISTS "Public can view visa verification links" ON public.visa_verification_links;

REVOKE SELECT ON public.visa_verification_links FROM anon, authenticated;

GRANT ALL ON public.visa_verification_links TO service_role;