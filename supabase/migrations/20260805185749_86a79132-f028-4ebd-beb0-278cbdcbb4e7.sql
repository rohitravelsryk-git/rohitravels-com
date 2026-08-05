ALTER TABLE public.group_tickets
  ADD COLUMN IF NOT EXISTS seats integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS agent_contact text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS booking_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS group_tickets_booking_id_key
  ON public.group_tickets (booking_id) WHERE booking_id IS NOT NULL;