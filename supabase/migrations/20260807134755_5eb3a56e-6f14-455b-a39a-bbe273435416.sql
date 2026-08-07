ALTER TABLE public.self_group_applications
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS destination text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS luggage text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS meal text NOT NULL DEFAULT 'Not Included',
  ADD COLUMN IF NOT EXISTS additional_25_paid numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS additional_25_paid_date date,
  ADD COLUMN IF NOT EXISTS balance_50_paid numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_50_paid_date date;