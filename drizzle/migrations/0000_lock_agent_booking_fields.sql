CREATE OR REPLACE FUNCTION public.is_approved_agent(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.agents WHERE user_id = _user_id AND status = 'approved'::agent_status);
$$;
REVOKE EXECUTE ON FUNCTION public.is_approved_agent(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_approved_agent(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.prevent_booking_status_self_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE is_admin boolean;
BEGIN
  is_admin := auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'::app_role);

  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NOT NULL AND NOT is_admin THEN
      NEW.status := 'submitted';
      NEW.payment_status := 'unpaid';
      NEW.ticket_status := 'pending';
      NEW.tickets := '[]'::jsonb;
    END IF;
    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL AND NOT is_admin THEN
    -- Agents may only change their uploaded files; every other column must stay as it was.
    IF (to_jsonb(NEW) - ARRAY['attachments','payment_slips','updated_at'])
       IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['attachments','payment_slips','updated_at']) THEN
      RAISE EXCEPTION 'Only admins can change booking details, fares, payment or ticket status';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP POLICY IF EXISTS "bookings own read" ON public.agent_bookings;
CREATE POLICY "bookings own read" ON public.agent_bookings
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)
         OR (auth.uid() = agent_user_id AND public.is_approved_agent(auth.uid())));

DROP POLICY IF EXISTS "bookings own update files" ON public.agent_bookings;
CREATE POLICY "bookings own update files" ON public.agent_bookings
  FOR UPDATE TO authenticated
  USING (auth.uid() = agent_user_id AND public.is_approved_agent(auth.uid()))
  WITH CHECK (auth.uid() = agent_user_id AND public.is_approved_agent(auth.uid())
              AND booking_state_unchanged(id, status, payment_status, ticket_status, tickets));

DROP POLICY IF EXISTS "bookings own insert" ON public.agent_bookings;
CREATE POLICY "bookings own insert" ON public.agent_bookings
  FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = agent_user_id) AND (has_role(auth.uid(), 'admin'::app_role)
    OR (public.is_approved_agent(auth.uid())
        AND (status = ANY (ARRAY['pending'::text, 'submitted'::text]))
        AND (payment_status = 'unpaid'::text)
        AND (ticket_status = ANY (ARRAY['pending'::text, 'submitted'::text]))
        AND (tickets = '[]'::jsonb))));