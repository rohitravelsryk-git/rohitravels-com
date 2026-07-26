
CREATE TABLE public.airlines (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  iata_code text NOT NULL,
  logo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.airlines TO anon, authenticated;
GRANT ALL ON public.airlines TO service_role;
ALTER TABLE public.airlines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view airlines" ON public.airlines FOR SELECT USING (true);

CREATE TABLE public.locations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  city text NOT NULL,
  code text NOT NULL,
  urdu_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (city, code)
);
GRANT SELECT ON public.locations TO anon, authenticated;
GRANT ALL ON public.locations TO service_role;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view locations" ON public.locations FOR SELECT USING (true);

CREATE TABLE public.luggage_options (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.luggage_options TO anon, authenticated;
GRANT ALL ON public.luggage_options TO service_role;
ALTER TABLE public.luggage_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view luggage" ON public.luggage_options FOR SELECT USING (true);

CREATE TRIGGER trg_airlines_updated_at BEFORE UPDATE ON public.airlines FOR EACH ROW EXECUTE FUNCTION public.update_fares_updated_at();
CREATE TRIGGER trg_locations_updated_at BEFORE UPDATE ON public.locations FOR EACH ROW EXECUTE FUNCTION public.update_fares_updated_at();
CREATE TRIGGER trg_luggage_updated_at BEFORE UPDATE ON public.luggage_options FOR EACH ROW EXECUTE FUNCTION public.update_fares_updated_at();

INSERT INTO public.airlines (name, iata_code) VALUES
  ('Flynas','XY'),('Flydubai','FZ'),('Saudia','SV'),('PIA','PK'),
  ('Airblue','PA'),('Air Arabia','G9'),('Emirates','EK'),('Qatar Airways','QR'),
  ('Etihad','EY'),('Gulf Air','GF'),('Oman Air','WY'),('Kuwait Airways','KU'),
  ('Salam Air','OV'),('Jazeera Airways','J9'),('Turkish Airlines','TK');

INSERT INTO public.locations (city, code, urdu_name) VALUES
  ('KARACHI','KHI','کراچی'),('LAHORE','LHE','لاہور'),('ISLAMABAD','ISB','اسلام آباد'),
  ('PESHAWAR','PEW','پشاور'),('MULTAN','MUX','ملتان'),('SIALKOT','SKT','سیالکوٹ'),
  ('FAISALABAD','LYP','فیصل آباد'),('QUETTA','UET','کوئٹہ'),
  ('JEDDAH','JED','جدہ'),('MADINAH','MED','مدینہ'),('RIYADH','RUH','ریاض'),
  ('DAMMAM','DMM','دمام'),('DUBAI','DXB','دبئی'),('ABU DHABI','AUH','ابو ظہبی'),
  ('SHARJAH','SHJ','شارجہ'),('MUSCAT','MCT','مسقط'),('DOHA','DOH','دوحہ'),
  ('KUWAIT','KWI','کویت'),('BAHRAIN','BAH','بحرین'),('ISTANBUL','IST','استنبول');

INSERT INTO public.luggage_options (label, sort_order) VALUES
  ('25+7KG',1),('30+7KG',2),('40+7KG',3),('20+7KG',4),('46+7KG',5),('HAND CARRY ONLY',6);
