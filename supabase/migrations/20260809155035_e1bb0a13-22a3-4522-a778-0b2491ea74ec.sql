CREATE TABLE public.login_otps (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purpose text NOT NULL CHECK (purpose IN ('admin','staff','agent')),
  subject text NOT NULL DEFAULT '',
  email text NOT NULL,
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamp with time zone NOT NULL,
  used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.login_otps TO service_role;

ALTER TABLE public.login_otps ENABLE ROW LEVEL SECURITY;

CREATE INDEX login_otps_created_idx ON public.login_otps (created_at DESC);