
CREATE OR REPLACE FUNCTION public.prevent_agent_status_self_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can change agent status';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_agent_status_admin_only ON public.agents;
CREATE TRIGGER enforce_agent_status_admin_only
BEFORE UPDATE ON public.agents
FOR EACH ROW EXECUTE FUNCTION public.prevent_agent_status_self_update();
