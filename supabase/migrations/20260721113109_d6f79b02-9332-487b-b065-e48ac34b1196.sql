
CREATE TABLE public.queries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_type TEXT NOT NULL CHECK (user_type IN ('customer','agent')),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  service TEXT NOT NULL DEFAULT 'General',
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT INSERT ON public.queries TO anon, authenticated;
GRANT ALL ON public.queries TO service_role;

ALTER TABLE public.queries ENABLE ROW LEVEL SECURITY;

-- Anyone can create a query (public inquiry form).
CREATE POLICY "Anyone can submit a query"
  ON public.queries FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    length(name) BETWEEN 1 AND 100
    AND length(phone) BETWEEN 5 AND 30
    AND length(message) BETWEEN 1 AND 2000
    AND user_type IN ('customer','agent')
  );

-- No public SELECT/UPDATE/DELETE. Admin uses service_role via server functions.

CREATE OR REPLACE FUNCTION public.update_queries_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_queries_updated_at
BEFORE UPDATE ON public.queries
FOR EACH ROW EXECUTE FUNCTION public.update_queries_updated_at();

CREATE INDEX idx_queries_type_created ON public.queries (user_type, created_at DESC);
CREATE INDEX idx_queries_service ON public.queries (service);
