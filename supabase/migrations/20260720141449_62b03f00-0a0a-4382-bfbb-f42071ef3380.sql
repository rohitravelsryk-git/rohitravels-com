REVOKE SELECT ON public.vouchers FROM anon, authenticated;
GRANT SELECT (id, sr, airline, expiry_date, passenger_name, created_at, updated_at) ON public.vouchers TO anon, authenticated;
GRANT ALL ON public.vouchers TO service_role;