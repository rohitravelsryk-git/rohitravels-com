
CREATE TABLE public.visa_verification_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  country text NOT NULL,
  purpose text NOT NULL,
  url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.visa_verification_links TO anon, authenticated;
GRANT ALL ON public.visa_verification_links TO service_role;

ALTER TABLE public.visa_verification_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view visa verification links"
  ON public.visa_verification_links FOR SELECT
  USING (true);

CREATE TRIGGER update_visa_verification_links_updated_at
  BEFORE UPDATE ON public.visa_verification_links
  FOR EACH ROW EXECUTE FUNCTION public.update_fares_updated_at();

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
