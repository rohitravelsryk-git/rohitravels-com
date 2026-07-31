-- 1) Unique agency code + duplicate protection on agents
CREATE SEQUENCE IF NOT EXISTS public.agent_code_seq START 1001;

ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS user_code text,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

UPDATE public.agents
SET user_code = 'RIT-' || lpad(nextval('public.agent_code_seq')::text, 4, '0')
WHERE user_code IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS agents_user_code_key ON public.agents (user_code);
CREATE UNIQUE INDEX IF NOT EXISTS agents_agency_name_lower_key ON public.agents (lower(agency_name));
CREATE UNIQUE INDEX IF NOT EXISTS agents_email_lower_key ON public.agents (lower(email));

-- 2) Agent-uploaded payment slips on bookings
ALTER TABLE public.agent_bookings
  ADD COLUMN IF NOT EXISTS payment_slips jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Agents may attach their own payment slips / update their own pending booking files
DROP POLICY IF EXISTS "bookings own update files" ON public.agent_bookings;
CREATE POLICY "bookings own update files"
ON public.agent_bookings
FOR UPDATE
TO authenticated
USING (auth.uid() = agent_user_id)
WITH CHECK (auth.uid() = agent_user_id);