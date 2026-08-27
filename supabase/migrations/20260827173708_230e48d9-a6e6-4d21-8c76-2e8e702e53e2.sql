CREATE TABLE IF NOT EXISTS public.airline_ledger_airlines (
  id text PRIMARY KEY,
  name text NOT NULL,
  code text NOT NULL DEFAULT '--',
  opening_balance numeric NOT NULL DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.airline_ledger_agents (
  name text PRIMARY KEY,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.airline_ledger_transactions (
  id text PRIMARY KEY,
  airline_id text NOT NULL,
  date date,
  agent_name text,
  pax_name text,
  sector text,
  pnr text,
  ticket_sales numeric,
  debit_in_id text,
  credit_from_id numeric,
  pax_contact text,
  void_charges numeric,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS airline_ledger_tx_airline_idx ON public.airline_ledger_transactions (airline_id, sort_order);

GRANT ALL ON public.airline_ledger_airlines TO service_role;
GRANT ALL ON public.airline_ledger_agents TO service_role;
GRANT ALL ON public.airline_ledger_transactions TO service_role;

ALTER TABLE public.airline_ledger_airlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.airline_ledger_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.airline_ledger_transactions ENABLE ROW LEVEL SECURITY;

-- Harden bank_details: authenticated agents may read, only admins may modify.
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.bank_details;
DROP POLICY IF EXISTS "bank_details_admin_write" ON public.bank_details;
DROP POLICY IF EXISTS "bank_details_authenticated_read" ON public.bank_details;
CREATE POLICY "bank_details_authenticated_read" ON public.bank_details
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "bank_details_admin_write" ON public.bank_details
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));