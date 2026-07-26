
-- Group tickets: bookings ledger with reminders
CREATE TABLE public.group_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seq BIGSERIAL,
  booking_date DATE,
  agent_name TEXT NOT NULL DEFAULT '',
  pax_name TEXT NOT NULL DEFAULT '',
  sector TEXT NOT NULL DEFAULT '',
  pnr TEXT NOT NULL DEFAULT '',
  airline TEXT NOT NULL DEFAULT '',
  travel_at TIMESTAMPTZ,
  flight_status TEXT NOT NULL DEFAULT 'BOOKED',
  otb TEXT NOT NULL DEFAULT 'NO',
  contact TEXT NOT NULL DEFAULT '',
  vendor TEXT NOT NULL DEFAULT '',
  sale NUMERIC(12,2) NOT NULL DEFAULT 0,
  purchase NUMERIC(12,2) NOT NULL DEFAULT 0,
  profit NUMERIC(12,2) GENERATED ALWAYS AS (sale - purchase) STORED,
  ledger_entry TEXT NOT NULL DEFAULT '',
  remarks TEXT NOT NULL DEFAULT '',
  reminder_24h_sent_at TIMESTAMPTZ,
  reminder_72h_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_tickets TO authenticated;
GRANT ALL ON public.group_tickets TO service_role;
ALTER TABLE public.group_tickets ENABLE ROW LEVEL SECURITY;
-- Server-only access via service role; no anon/authenticated policies needed.
CREATE POLICY "service_role_all_group_tickets" ON public.group_tickets FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX group_tickets_travel_at_idx ON public.group_tickets (travel_at);
CREATE INDEX group_tickets_seq_idx ON public.group_tickets (seq);

CREATE TRIGGER trg_group_tickets_updated
BEFORE UPDATE ON public.group_tickets
FOR EACH ROW EXECUTE FUNCTION public.update_fares_updated_at();

-- Notifications for the admin bell/badge on the tab
CREATE TABLE public.ticket_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.group_tickets(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,             -- '72h' | '24h' | 'departed'
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  channels_sent JSONB NOT NULL DEFAULT '[]'::jsonb, -- e.g. ["email","whatsapp"]
  seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ticket_id, kind)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_notifications TO authenticated;
GRANT ALL ON public.ticket_notifications TO service_role;
ALTER TABLE public.ticket_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_ticket_notifications" ON public.ticket_notifications FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX ticket_notifications_unseen_idx ON public.ticket_notifications (seen_at) WHERE seen_at IS NULL;
