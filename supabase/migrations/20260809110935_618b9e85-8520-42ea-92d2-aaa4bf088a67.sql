ALTER TABLE public.agent_bookings ADD COLUMN IF NOT EXISTS booking_ref text;

CREATE SEQUENCE IF NOT EXISTS public.agent_booking_ref_seq START 1;

CREATE OR REPLACE FUNCTION public.set_agent_booking_ref()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.booking_ref IS NULL OR NEW.booking_ref = '' THEN
    NEW.booking_ref := 'ROHI' || lpad(nextval('public.agent_booking_ref_seq')::text, 2, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_agent_booking_ref ON public.agent_bookings;
CREATE TRIGGER trg_agent_booking_ref
BEFORE INSERT ON public.agent_bookings
FOR EACH ROW EXECUTE FUNCTION public.set_agent_booking_ref();

-- Backfill existing rows in creation order
WITH ordered AS (
  SELECT id, row_number() OVER (ORDER BY created_at) AS rn
  FROM public.agent_bookings
  WHERE booking_ref IS NULL OR booking_ref = ''
)
UPDATE public.agent_bookings b
SET booking_ref = 'ROHI' || lpad(o.rn::text, 2, '0')
FROM ordered o
WHERE b.id = o.id;

SELECT setval('public.agent_booking_ref_seq', GREATEST(1, (SELECT count(*) FROM public.agent_bookings)));

CREATE UNIQUE INDEX IF NOT EXISTS agent_bookings_booking_ref_key ON public.agent_bookings (booking_ref);

-- Agents submit bookings with status 'submitted'; allow it alongside 'pending'
DROP POLICY IF EXISTS "bookings own insert" ON public.agent_bookings;
CREATE POLICY "bookings own insert" ON public.agent_bookings
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = agent_user_id AND (
    has_role(auth.uid(), 'admin'::app_role) OR (
      status IN ('pending','submitted')
      AND payment_status = 'unpaid'
      AND ticket_status IN ('pending','submitted')
      AND tickets = '[]'::jsonb
    )
  )
);