CREATE TABLE public.fares (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  origin TEXT NOT NULL,
  origin_code TEXT NOT NULL,
  destination TEXT NOT NULL,
  destination_code TEXT NOT NULL,
  airline TEXT NOT NULL,
  flight_date TEXT NOT NULL,
  flight_number TEXT,
  depart_time TEXT,
  arrive_time TEXT,
  baggage TEXT DEFAULT '25+7KG',
  category TEXT NOT NULL DEFAULT 'JEDDAH',
  price_text TEXT NOT NULL DEFAULT 'FARE ON WHATSAPP',
  is_featured BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.fares TO anon;
GRANT SELECT ON public.fares TO authenticated;
GRANT ALL ON public.fares TO service_role;

ALTER TABLE public.fares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view fares" ON public.fares FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.update_fares_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_fares_updated_at BEFORE UPDATE ON public.fares FOR EACH ROW EXECUTE FUNCTION public.update_fares_updated_at();

INSERT INTO public.fares (origin, origin_code, destination, destination_code, airline, flight_date, flight_number, depart_time, arrive_time, baggage, category, price_text, is_featured, sort_order) VALUES
('KARACHI', 'KHI', 'JEDDAH', 'JED', 'flyadeal', '26JUL', 'KHIJED', '0800', '1100', '25+7KG', 'JEDDAH', 'FARE ON WHATSAPP', true, 1),
('KARACHI', 'KHI', 'JEDDAH', 'JED', 'Saudia', '02AUG', 'SV721', '0930', '1230', '30+7KG', 'JEDDAH', 'FARE ON WHATSAPP', false, 2),
('KARACHI', 'KHI', 'JEDDAH', 'JED', 'PIA', '15AUG', 'PK731', '2100', '0030', '30+7KG', 'UMRAH', 'FARE ON WHATSAPP', false, 3),
('KARACHI', 'KHI', 'MUSCAT', 'MCT', 'Oman Air', '10AUG', 'WY612', '1400', '1530', '30+7KG', 'MUSCAT', 'FARE ON WHATSAPP', false, 4),
('LAHORE', 'LHE', 'RIYADH', 'RUH', 'Saudia', '20AUG', 'SV735', '0400', '0630', '30+7KG', 'RIYADH', 'FARE ON WHATSAPP', false, 5),
('ISLAMABAD', 'ISB', 'RIYADH', 'RUH', 'PIA', '25AUG', 'PK733', '0100', '0330', '30+7KG', 'RIYADH', 'FARE ON WHATSAPP', false, 6),
('KARACHI', 'KHI', 'JEDDAH', 'JED', 'flynas', '05SEP', 'XY121', '1030', '1330', '25+7KG', 'UMRAH', 'FARE ON WHATSAPP', false, 7);