-- Update the booking reference generation to be non-sequential and unique
CREATE OR REPLACE FUNCTION public.set_agent_booking_ref()
RETURNS TRIGGER AS $$
DECLARE
  new_ref text;
  is_unique boolean := false;
BEGIN
  -- Only generate if booking_ref is not already set
  IF NEW.booking_ref IS NULL OR NEW.booking_ref = '' THEN
    WHILE NOT is_unique LOOP
      -- Generate a reference starting with 'ROHI' followed by 4 random uppercase letters/numbers
      new_ref := 'ROHI' || UPPER(SUBSTRING(md5(random()::text), 1, 4));
      
      -- Check for collisions
      SELECT NOT EXISTS (
        SELECT 1 FROM public.agent_bookings WHERE booking_ref = new_ref
      ) INTO is_unique;
    END LOOP;
    
    NEW.booking_ref := new_ref;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
