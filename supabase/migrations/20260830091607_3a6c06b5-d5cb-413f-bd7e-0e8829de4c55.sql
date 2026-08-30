DROP POLICY IF EXISTS "bank_details_authenticated_read" ON public.bank_details;
CREATE POLICY "bank_details_admin_read" ON public.bank_details
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
REVOKE SELECT ON public.bank_details FROM anon;