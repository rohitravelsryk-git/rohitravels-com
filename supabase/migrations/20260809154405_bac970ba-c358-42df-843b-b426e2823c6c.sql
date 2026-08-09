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
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
       OR NEW.ticket_status IS DISTINCT FROM OLD.ticket_status
       OR NEW.tickets IS DISTINCT FROM OLD.tickets THEN
      RAISE EXCEPTION 'Only admins can change booking, payment or ticket status';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;