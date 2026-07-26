
CREATE TABLE public.vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sr integer NOT NULL DEFAULT 0,
  name text NOT NULL,
  expiry_date text NOT NULL DEFAULT '',
  alert_date text NOT NULL DEFAULT '',
  days_left text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'ACTIVE',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.vouchers TO anon, authenticated;
GRANT ALL ON public.vouchers TO service_role;

ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view vouchers"
  ON public.vouchers FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE TRIGGER update_vouchers_updated_at
  BEFORE UPDATE ON public.vouchers
  FOR EACH ROW EXECUTE FUNCTION public.update_fares_updated_at();
