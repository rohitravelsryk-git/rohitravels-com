REVOKE SELECT ON public.fares FROM anon, authenticated;

GRANT SELECT (
  id, origin, origin_code, destination, destination_code, airline,
  flight_date, flight_number, depart_time, arrive_time, baggage, meal, seats,
  category, price_text, is_featured, sort_order, flight_details,
  group_type, pnr, is_deleted, deleted_at, hide_fare_after_2h, auto_hide_hours,
  created_at, updated_at
) ON public.fares TO anon, authenticated;

GRANT ALL ON public.fares TO service_role;