CREATE TABLE public.bank_details (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    bank_name text NOT NULL,
    bank_logo_url text,
    account_name text NOT NULL,
    account_no text NOT NULL,
    iban text NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- Permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_details TO authenticated;
GRANT ALL ON public.bank_details TO service_role;
GRANT SELECT ON public.bank_details TO anon;

-- RLS
ALTER TABLE public.bank_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON public.bank_details FOR SELECT USING (true);
CREATE POLICY "Allow admin all access" ON public.bank_details FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
