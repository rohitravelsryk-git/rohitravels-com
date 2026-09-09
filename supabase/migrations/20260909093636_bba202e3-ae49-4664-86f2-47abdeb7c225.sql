CREATE OR REPLACE FUNCTION public.agent_admin_fields_unchanged(_user_id uuid, _status agent_status, _approved_at timestamptz, _user_code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.agents a
    WHERE a.user_id = _user_id
      AND a.status = _status
      AND a.approved_at IS NOT DISTINCT FROM _approved_at
      AND a.user_code IS NOT DISTINCT FROM _user_code
  );
$$;

REVOKE ALL ON FUNCTION public.agent_admin_fields_unchanged(uuid, agent_status, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agent_admin_fields_unchanged(uuid, agent_status, timestamptz, text) TO authenticated, service_role;