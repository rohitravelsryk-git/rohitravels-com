
ALTER TABLE public.fares ADD COLUMN IF NOT EXISTS group_type TEXT NOT NULL DEFAULT 'party';
ALTER TABLE public.group_tickets ADD COLUMN IF NOT EXISTS group_type TEXT NOT NULL DEFAULT 'party';

CREATE TABLE IF NOT EXISTS public.self_group_passengers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fare_id UUID REFERENCES public.fares(id) ON DELETE SET NULL,
  ticket_id UUID REFERENCES public.group_tickets(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'MR',
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  dob DATE,
  nationality TEXT NOT NULL DEFAULT 'PAKISTANI',
  issued_by_country TEXT NOT NULL DEFAULT 'PAKISTAN',
  doc_type TEXT NOT NULL DEFAULT 'PassPort',
  doc_number TEXT NOT NULL DEFAULT '',
  expire_date DATE,
  pnr TEXT NOT NULL DEFAULT '',
  sector TEXT NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.self_group_passengers TO service_role;
ALTER TABLE public.self_group_passengers ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS self_group_passengers_fare_idx ON public.self_group_passengers(fare_id);
CREATE INDEX IF NOT EXISTS self_group_passengers_ticket_idx ON public.self_group_passengers(ticket_id);

CREATE TRIGGER trg_self_group_passengers_updated
BEFORE UPDATE ON public.self_group_passengers
FOR EACH ROW EXECUTE FUNCTION public.update_fares_updated_at();
