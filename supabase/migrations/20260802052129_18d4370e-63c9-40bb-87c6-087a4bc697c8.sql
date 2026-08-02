CREATE OR REPLACE FUNCTION public.booking_state_unchanged(_id uuid, _status text, _payment_status text, _ticket_status text, _tickets jsonb)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.agent_bookings b
    WHERE b.id = _id
      AND b.status = _status
      AND b.payment_status = _payment_status
      AND b.ticket_status = _ticket_status
      AND b.tickets = _tickets
  );
$$;

GRANT EXECUTE ON FUNCTION public.booking_state_unchanged(uuid, text, text, text, jsonb) TO authenticated;

DROP POLICY IF EXISTS "bookings own update files" ON public.agent_bookings;

CREATE POLICY "bookings own update files"
ON public.agent_bookings
FOR UPDATE
TO authenticated
USING (auth.uid() = agent_user_id)
WITH CHECK (
  auth.uid() = agent_user_id
  AND public.booking_state_unchanged(id, status, payment_status, ticket_status, tickets)
);