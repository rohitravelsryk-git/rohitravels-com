CREATE TABLE public.self_group_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fare_id UUID REFERENCES public.fares(id) ON DELETE SET NULL,
  group_label TEXT NOT NULL DEFAULT '',
  applied_date DATE,
  airline TEXT NOT NULL DEFAULT '',
  sector TEXT NOT NULL DEFAULT '',
  flight_date DATE,
  tr TEXT NOT NULL DEFAULT '',
  flight_details TEXT NOT NULL DEFAULT '',
  seats INTEGER NOT NULL DEFAULT 0,
  fare_per_pax NUMERIC NOT NULL DEFAULT 0,
  initial_deposit_paid_date DATE,
  final_deposit_paid_date DATE,
  final_deposit_paid NUMERIC NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.self_group_applications TO service_role;

ALTER TABLE public.self_group_applications ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_self_group_applications_updated_at
BEFORE UPDATE ON public.self_group_applications
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();