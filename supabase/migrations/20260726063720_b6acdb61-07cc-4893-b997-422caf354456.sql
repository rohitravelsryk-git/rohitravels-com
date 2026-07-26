CREATE TABLE public.fares (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  origin TEXT NOT NULL, origin_code TEXT NOT NULL,
  destination TEXT NOT NULL, destination_code TEXT NOT NULL,
  airline TEXT NOT NULL, flight_date TEXT NOT NULL,
  flight_number TEXT, depart_time TEXT, arrive_time TEXT,
  baggage TEXT DEFAULT '25+7KG', category TEXT NOT NULL DEFAULT 'JEDDAH',
  price_text TEXT NOT NULL DEFAULT 'FARE ON WHATSAPP',
  is_featured BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  vendor_fare text, vendor_name text, flight_details text,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.fares TO service_role;
ALTER TABLE public.fares ENABLE ROW LEVEL SECURITY;
GRANT SELECT (id, origin, origin_code, destination, destination_code, airline, flight_date, flight_number, depart_time, arrive_time, flight_details, baggage, category, price_text, is_featured, sort_order, created_at, updated_at) ON public.fares TO anon, authenticated;
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

CREATE TABLE public.airlines (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL UNIQUE, iata_code text NOT NULL, logo_url text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.airlines TO anon, authenticated; GRANT ALL ON public.airlines TO service_role;
ALTER TABLE public.airlines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view airlines" ON public.airlines FOR SELECT USING (true);
CREATE TRIGGER trg_airlines_updated_at BEFORE UPDATE ON public.airlines FOR EACH ROW EXECUTE FUNCTION public.update_fares_updated_at();
INSERT INTO public.airlines (name, iata_code) VALUES
  ('Flynas','XY'),('Flydubai','FZ'),('Saudia','SV'),('PIA','PK'),
  ('Airblue','PA'),('Air Arabia','G9'),('Emirates','EK'),('Qatar Airways','QR'),
  ('Etihad','EY'),('Gulf Air','GF'),('Oman Air','WY'),('Kuwait Airways','KU'),
  ('Salam Air','OV'),('Jazeera Airways','J9'),('Turkish Airlines','TK');

CREATE TABLE public.locations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), city text NOT NULL, code text NOT NULL, urdu_name text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (city, code));
GRANT SELECT ON public.locations TO anon, authenticated; GRANT ALL ON public.locations TO service_role;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view locations" ON public.locations FOR SELECT USING (true);
CREATE TRIGGER trg_locations_updated_at BEFORE UPDATE ON public.locations FOR EACH ROW EXECUTE FUNCTION public.update_fares_updated_at();
INSERT INTO public.locations (city, code, urdu_name) VALUES
  ('KARACHI','KHI','کراچی'),('LAHORE','LHE','لاہور'),('ISLAMABAD','ISB','اسلام آباد'),
  ('PESHAWAR','PEW','پشاور'),('MULTAN','MUX','ملتان'),('SIALKOT','SKT','سیالکوٹ'),
  ('FAISALABAD','LYP','فیصل آباد'),('QUETTA','UET','کوئٹہ'),
  ('JEDDAH','JED','جدہ'),('MADINAH','MED','مدینہ'),('RIYADH','RUH','ریاض'),
  ('DAMMAM','DMM','دمام'),('DUBAI','DXB','دبئی'),('ABU DHABI','AUH','ابو ظہبی'),
  ('SHARJAH','SHJ','شارجہ'),('MUSCAT','MCT','مسقط'),('DOHA','DOH','دوحہ'),
  ('KUWAIT','KWI','کویت'),('BAHRAIN','BAH','بحرین'),('ISTANBUL','IST','استنبول');

CREATE TABLE public.luggage_options (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), label text NOT NULL UNIQUE, sort_order integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.luggage_options TO anon, authenticated; GRANT ALL ON public.luggage_options TO service_role;
ALTER TABLE public.luggage_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view luggage" ON public.luggage_options FOR SELECT USING (true);
CREATE TRIGGER trg_luggage_updated_at BEFORE UPDATE ON public.luggage_options FOR EACH ROW EXECUTE FUNCTION public.update_fares_updated_at();
INSERT INTO public.luggage_options (label, sort_order) VALUES
  ('25+7KG',1),('30+7KG',2),('40+7KG',3),('20+7KG',4),('46+7KG',5),('HAND CARRY ONLY',6);

CREATE TABLE public.vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sr integer NOT NULL DEFAULT 0, name text NOT NULL,
  expiry_date text NOT NULL DEFAULT '', alert_date text NOT NULL DEFAULT '',
  days_left text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'ACTIVE',
  notes text NOT NULL DEFAULT '',
  agent_name text NOT NULL DEFAULT '', passenger_name text NOT NULL DEFAULT '',
  pnr text NOT NULL DEFAULT '', voucher_amount text NOT NULL DEFAULT '',
  airline text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.vouchers TO service_role;
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct public voucher access" ON public.vouchers FOR SELECT USING (false);
CREATE TRIGGER update_vouchers_updated_at BEFORE UPDATE ON public.vouchers FOR EACH ROW EXECUTE FUNCTION public.update_fares_updated_at();

CREATE TABLE public.admin_credentials (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id = true),
  password_hash TEXT NOT NULL, recovery_email TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_credentials TO service_role;
ALTER TABLE public.admin_credentials ENABLE ROW LEVEL SECURITY;
INSERT INTO public.admin_credentials (id, password_hash, recovery_email) VALUES (true, '', 'rohitravels@gmail.com') ON CONFLICT (id) DO NOTHING;

CREATE TABLE public.admin_password_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_password_resets TO service_role;
ALTER TABLE public.admin_password_resets ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.visa_verification_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country text NOT NULL, purpose text NOT NULL, url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.visa_verification_links TO anon, authenticated;
GRANT ALL ON public.visa_verification_links TO service_role;
ALTER TABLE public.visa_verification_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view visa verification links" ON public.visa_verification_links FOR SELECT USING (true);
CREATE TRIGGER update_visa_verification_links_updated_at BEFORE UPDATE ON public.visa_verification_links FOR EACH ROW EXECUTE FUNCTION public.update_fares_updated_at();
INSERT INTO public.visa_verification_links (country, purpose, url, sort_order) VALUES
  ('Saudi Arabia', 'Verify visa issued by Ministry of Foreign Affairs (MOFA)', 'https://visa.mofa.gov.sa/Account/EnquireByVisa', 10),
  ('Saudi Arabia', 'Enjazit visa application / status check', 'https://enjazit.com.sa/', 20),
  ('United Arab Emirates', 'Check UAE / Dubai visa status (ICP smart services)', 'https://smartservices.icp.gov.ae/echannels/web/client/default.html#/fileValidity', 30),
  ('United Arab Emirates', 'GDRFA Dubai visa / entry permit status', 'https://smart.gdrfad.gov.ae/Smart_OTCServicesPortal/EntryPermitInquiry.aspx', 40),
  ('Oman', 'Royal Oman Police visa status check', 'https://evisa.rop.gov.om/en/home', 50),
  ('Qatar', 'MOI Qatar visa inquiry & printing', 'https://portal.moi.gov.qa/wps/portal/MOIInternet/services/individualservices/inqvisaservices', 60),
  ('Bahrain', 'Bahrain e-visa application status', 'https://www.evisa.gov.bh/VISA/InquireApplication_input.do', 70),
  ('Kuwait', 'Kuwait e-visa portal', 'https://evisa.moi.gov.kw/evisa/home_e.do', 80),
  ('Turkey', 'Turkey e-visa application enquiry', 'https://www.evisa.gov.tr/en/', 90);

CREATE TABLE public.queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seq BIGSERIAL,
  user_type TEXT NOT NULL CHECK (user_type IN ('customer','agent')),
  name TEXT NOT NULL, phone TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '', service TEXT NOT NULL DEFAULT 'General',
  message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new',
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT INSERT ON public.queries TO anon, authenticated;
GRANT ALL ON public.queries TO service_role;
ALTER TABLE public.queries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can submit a query" ON public.queries FOR INSERT TO anon, authenticated
  WITH CHECK (length(name) BETWEEN 1 AND 100 AND length(phone) BETWEEN 5 AND 30 AND length(message) BETWEEN 1 AND 2000 AND user_type IN ('customer','agent'));
CREATE OR REPLACE FUNCTION public.update_queries_updated_at() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER trg_queries_updated_at BEFORE UPDATE ON public.queries FOR EACH ROW EXECUTE FUNCTION public.update_queries_updated_at();
CREATE INDEX idx_queries_type_created ON public.queries (user_type, created_at DESC);
CREATE INDEX idx_queries_service ON public.queries (service);

CREATE TABLE public.inquiry_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL UNIQUE, sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.inquiry_services TO anon, authenticated;
GRANT ALL ON public.inquiry_services TO service_role;
ALTER TABLE public.inquiry_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read services" ON public.inquiry_services FOR SELECT USING (true);
INSERT INTO public.inquiry_services (label, sort_order) VALUES
  ('Group Fares', 10),('Umrah Package', 20),('Hajj Package', 30),
  ('Ticket Booking', 40),('Visa Services', 50),('Hotel Booking', 60),
  ('OK TO BOARD', 70),('Discount Vouchers', 80),('Other', 999)
ON CONFLICT (label) DO NOTHING;

CREATE POLICY "query_attachments_deny_anon_select" ON storage.objects FOR SELECT TO anon USING (false);
CREATE POLICY "query_attachments_deny_auth_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id <> 'query-attachments');
CREATE POLICY "query_attachments_deny_anon_insert" ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id <> 'query-attachments');
CREATE POLICY "query_attachments_deny_auth_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id <> 'query-attachments');
CREATE POLICY "query_attachments_deny_anon_update" ON storage.objects FOR UPDATE TO anon USING (false);
CREATE POLICY "query_attachments_deny_auth_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id <> 'query-attachments');
CREATE POLICY "query_attachments_deny_anon_delete" ON storage.objects FOR DELETE TO anon USING (false);
CREATE POLICY "query_attachments_deny_auth_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id <> 'query-attachments');

CREATE TABLE public.group_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seq BIGSERIAL, booking_date DATE,
  agent_name TEXT NOT NULL DEFAULT '', pax_name TEXT NOT NULL DEFAULT '',
  sector TEXT NOT NULL DEFAULT '', pnr TEXT NOT NULL DEFAULT '',
  airline TEXT NOT NULL DEFAULT '', travel_at TIMESTAMPTZ,
  flight_status TEXT NOT NULL DEFAULT 'BOOKED', otb TEXT NOT NULL DEFAULT 'NO',
  contact TEXT NOT NULL DEFAULT '', vendor TEXT NOT NULL DEFAULT '',
  sale NUMERIC(12,2) NOT NULL DEFAULT 0, purchase NUMERIC(12,2) NOT NULL DEFAULT 0,
  profit NUMERIC(12,2) GENERATED ALWAYS AS (sale - purchase) STORED,
  ledger_entry TEXT NOT NULL DEFAULT '', remarks TEXT NOT NULL DEFAULT '',
  reminder_24h_sent_at TIMESTAMPTZ, reminder_72h_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_tickets TO authenticated;
GRANT ALL ON public.group_tickets TO service_role;
ALTER TABLE public.group_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_group_tickets" ON public.group_tickets FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX group_tickets_travel_at_idx ON public.group_tickets (travel_at);
CREATE INDEX group_tickets_seq_idx ON public.group_tickets (seq);
CREATE TRIGGER trg_group_tickets_updated BEFORE UPDATE ON public.group_tickets FOR EACH ROW EXECUTE FUNCTION public.update_fares_updated_at();

CREATE TABLE public.ticket_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.group_tickets(id) ON DELETE CASCADE,
  kind TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL DEFAULT '',
  channels_sent JSONB NOT NULL DEFAULT '[]'::jsonb,
  seen_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ticket_id, kind)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_notifications TO authenticated;
GRANT ALL ON public.ticket_notifications TO service_role;
ALTER TABLE public.ticket_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_ticket_notifications" ON public.ticket_notifications FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX ticket_notifications_unseen_idx ON public.ticket_notifications (seen_at) WHERE seen_at IS NULL;