-- Airline ledger tables: explicit server-only access, matching sibling airline_balance_* tables
REVOKE ALL ON public.airline_ledger_agents FROM anon, authenticated;
REVOKE ALL ON public.airline_ledger_airlines FROM anon, authenticated;
REVOKE ALL ON public.airline_ledger_transactions FROM anon, authenticated;

GRANT ALL ON public.airline_ledger_agents TO service_role;
GRANT ALL ON public.airline_ledger_airlines TO service_role;
GRANT ALL ON public.airline_ledger_transactions TO service_role;

ALTER TABLE public.airline_ledger_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.airline_ledger_airlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.airline_ledger_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_manages_airline_ledger_agents" ON public.airline_ledger_agents;
CREATE POLICY "service_role_manages_airline_ledger_agents"
  ON public.airline_ledger_agents FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_manages_airline_ledger_airlines" ON public.airline_ledger_airlines;
CREATE POLICY "service_role_manages_airline_ledger_airlines"
  ON public.airline_ledger_airlines FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_manages_airline_ledger_transactions" ON public.airline_ledger_transactions;
CREATE POLICY "service_role_manages_airline_ledger_transactions"
  ON public.airline_ledger_transactions FOR ALL TO service_role USING (true) WITH CHECK (true);