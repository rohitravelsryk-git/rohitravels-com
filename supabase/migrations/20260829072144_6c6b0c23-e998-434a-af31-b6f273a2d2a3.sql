DROP POLICY IF EXISTS "Allow public read access" ON public.bank_details;
REVOKE SELECT ON public.bank_details FROM anon;