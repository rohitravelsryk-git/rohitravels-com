
-- Admin credentials (single row, hashed password)
CREATE TABLE public.admin_credentials (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id = true),
  password_hash TEXT NOT NULL,
  recovery_email TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_credentials TO service_role;
ALTER TABLE public.admin_credentials ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role (server) may touch this table.

-- Password reset codes (short-lived OTPs)
CREATE TABLE public.admin_password_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_password_resets TO service_role;
ALTER TABLE public.admin_password_resets ENABLE ROW LEVEL SECURITY;

-- Seed the single credentials row with recovery email; password_hash left empty
-- and will be initialized on first successful login using the existing SITE_PASSWORD.
INSERT INTO public.admin_credentials (id, password_hash, recovery_email)
VALUES (true, '', 'rohitravels@gmail.com')
ON CONFLICT (id) DO NOTHING;
