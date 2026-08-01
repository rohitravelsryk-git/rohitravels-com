-- Attach protection triggers (functions existed but were not attached)
DROP TRIGGER IF EXISTS trg_prevent_booking_status_self_update ON public.agent_bookings;
CREATE TRIGGER trg_prevent_booking_status_self_update
BEFORE INSERT OR UPDATE ON public.agent_bookings
FOR EACH ROW EXECUTE FUNCTION public.prevent_booking_status_self_update();

DROP TRIGGER IF EXISTS trg_prevent_agent_status_self_update ON public.agents;
CREATE TRIGGER trg_prevent_agent_status_self_update
BEFORE UPDATE ON public.agents
FOR EACH ROW EXECUTE FUNCTION public.prevent_agent_status_self_update();

-- Tighten policies so agents can only submit/keep safe values
DROP POLICY IF EXISTS "bookings own insert" ON public.agent_bookings;
CREATE POLICY "bookings own insert" ON public.agent_bookings
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = agent_user_id
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR (
      status = 'pending'
      AND payment_status = 'unpaid'
      AND ticket_status = 'pending'
      AND tickets = '[]'::jsonb
    )
  )
);

DROP POLICY IF EXISTS "bookings own update files" ON public.agent_bookings;
CREATE POLICY "bookings own update files" ON public.agent_bookings
FOR UPDATE TO authenticated
USING (auth.uid() = agent_user_id)
WITH CHECK (auth.uid() = agent_user_id);