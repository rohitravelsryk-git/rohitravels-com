CREATE TABLE public.airline_balance_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airline_id uuid NOT NULL REFERENCES public.airlines(id) ON DELETE CASCADE,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  agent_name text NOT NULL DEFAULT '',
  pax_name text NOT NULL DEFAULT '',
  sector text NOT NULL DEFAULT '',
  pnr text NOT NULL DEFAULT '',
  ticket_sales numeric NOT NULL DEFAULT 0,
  debit_in_id numeric NOT NULL DEFAULT 0,
  credit_from_id numeric NOT NULL DEFAULT 0,
  pax_contact text NOT NULL DEFAULT '',
  void_charges numeric NOT NULL DEFAULT 0,
  ledger_entry text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.airline_balance_entries TO authenticated;
GRANT ALL ON public.airline_balance_entries TO service_role;
ALTER TABLE public.airline_balance_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage airline balance entries" ON public.airline_balance_entries FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.airline_balance_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airline_id uuid NOT NULL REFERENCES public.airlines(id) ON DELETE CASCADE,
  account_label text NOT NULL DEFAULT 'Primary Account',
  opening_balance numeric NOT NULL DEFAULT 0,
  sheet_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (airline_id, account_label)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.airline_balance_accounts TO authenticated;
GRANT ALL ON public.airline_balance_accounts TO service_role;
ALTER TABLE public.airline_balance_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage airline balance accounts" ON public.airline_balance_accounts FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));