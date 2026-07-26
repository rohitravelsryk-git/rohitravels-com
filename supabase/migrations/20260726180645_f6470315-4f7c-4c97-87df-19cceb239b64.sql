-- Fares: revoke wide SELECT, then grant only non-vendor columns to public roles.
REVOKE SELECT ON public.fares FROM anon, authenticated;

GRANT SELECT (
  id, origin, origin_code, destination, destination_code, airline,
  flight_date, flight_number, depart_time, arrive_time, baggage, category,
  price_text, is_featured, sort_order, flight_details,
  created_at, updated_at, meal, seats
) ON public.fares TO anon, authenticated;

GRANT ALL ON public.fares TO service_role;

-- Vendors: restrict authenticated SELECT to admins only.
DROP POLICY IF EXISTS "Authenticated can view vendors" ON public.vendors;

CREATE POLICY "Admins can view vendors"
ON public.vendors
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));