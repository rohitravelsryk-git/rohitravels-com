CREATE OR REPLACE FUNCTION public.agent_admin_fields_unchanged(_user_id uuid, _status agent_status, _approved_at timestamptz, _user_code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.agents a
    WHERE a.user_id = _user_id
      AND a.status = _status
      AND a.approved_at IS NOT DISTINCT FROM _approved_at
      AND a.user_code IS NOT DISTINCT FROM _user_code
  );
$$;

REVOKE ALL ON FUNCTION public.agent_admin_fields_unchanged(uuid, agent_status, timestamptz, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.agent_admin_fields_unchanged(uuid, agent_status, timestamptz, text) TO authenticated, service_role;

DROP POLICY IF EXISTS "agents self update non-status" ON public.agents;
CREATE POLICY "agents self update non-status" ON public.agents
FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (
    auth.uid() = user_id
    AND public.agent_admin_fields_unchanged(user_id, status, approved_at, user_code)
  )
);

DROP POLICY IF EXISTS "agents self insert" ON public.agents;
CREATE POLICY "agents self insert" ON public.agents
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (status = 'pending'::agent_status AND approved_at IS NULL)
  )
);