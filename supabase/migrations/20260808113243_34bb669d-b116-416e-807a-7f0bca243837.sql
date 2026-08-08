ALTER TABLE public.self_group_applications
  ADD COLUMN IF NOT EXISTS pnr text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS deposit_alert_sent_at timestamptz;