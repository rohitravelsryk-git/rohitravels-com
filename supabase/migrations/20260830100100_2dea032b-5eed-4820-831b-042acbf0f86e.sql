-- Harden b2b_sticky_notes: restrict SELECT to authenticated B2B agents/admins only.
DROP POLICY IF EXISTS "Public read access" ON public.b2b_sticky_notes;
DROP POLICY IF EXISTS "Anyone can read enabled sticky notes" ON public.b2b_sticky_notes;

CREATE POLICY "b2b_sticky_notes_authenticated_read"
  ON public.b2b_sticky_notes
  FOR SELECT TO authenticated
  USING (is_enabled = true);

DROP POLICY IF EXISTS "b2b_sticky_notes_admin_write" ON public.b2b_sticky_notes;
CREATE POLICY "b2b_sticky_notes_admin_write"
  ON public.b2b_sticky_notes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

REVOKE ALL ON public.b2b_sticky_notes FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.b2b_sticky_notes TO authenticated;
GRANT ALL ON public.b2b_sticky_notes TO service_role;