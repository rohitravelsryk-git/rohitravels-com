CREATE OR REPLACE FUNCTION public.admin_reset_dataset(_target text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _deleted bigint := 0;
BEGIN
  IF _target = 'group_tickets' THEN
    DELETE FROM public.ticket_notifications;
    UPDATE public.self_group_passengers SET ticket_id = NULL WHERE ticket_id IS NOT NULL;
    WITH d AS (DELETE FROM public.group_tickets RETURNING 1) SELECT count(*) INTO _deleted FROM d;
    ALTER SEQUENCE public.group_tickets_seq_seq RESTART WITH 1;
  ELSIF _target = 'agent_bookings' THEN
    UPDATE public.group_tickets SET booking_id = NULL WHERE booking_id IS NOT NULL;
    WITH d AS (DELETE FROM public.agent_bookings RETURNING 1) SELECT count(*) INTO _deleted FROM d;
    ALTER SEQUENCE public.agent_booking_ref_seq RESTART WITH 1;
  ELSIF _target = 'queries' THEN
    WITH d AS (DELETE FROM public.queries RETURNING 1) SELECT count(*) INTO _deleted FROM d;
    ALTER SEQUENCE public.queries_seq_seq RESTART WITH 1;
  ELSE
    RAISE EXCEPTION 'Unknown reset target: %', _target;
  END IF;

  RETURN jsonb_build_object('target', _target, 'deleted', _deleted);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reset_dataset(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_reset_dataset(text) FROM anon;
REVOKE ALL ON FUNCTION public.admin_reset_dataset(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_dataset(text) TO service_role;