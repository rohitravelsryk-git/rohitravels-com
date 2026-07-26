
REVOKE SELECT ON public.fares FROM anon, authenticated;

GRANT SELECT (
  id, origin, origin_code, destination, destination_code,
  airline, flight_date, flight_number, depart_time, arrive_time,
  flight_details, baggage, category, price_text,
  is_featured, sort_order, created_at, updated_at
) ON public.fares TO anon, authenticated;
