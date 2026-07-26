CREATE TABLE public.inquiry_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL UNIQUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.inquiry_services TO anon, authenticated;
GRANT ALL ON public.inquiry_services TO service_role;
ALTER TABLE public.inquiry_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read services" ON public.inquiry_services FOR SELECT USING (true);
INSERT INTO public.inquiry_services (label, sort_order) VALUES
  ('Group Fares', 10),
  ('Umrah Package', 20),
  ('Hajj Package', 30),
  ('Ticket Booking', 40),
  ('Visa Services', 50),
  ('Hotel Booking', 60),
  ('OK TO BOARD', 70),
  ('Discount Vouchers', 80),
  ('Other', 999)
ON CONFLICT (label) DO NOTHING;