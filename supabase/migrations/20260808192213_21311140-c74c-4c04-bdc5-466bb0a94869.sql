CREATE TABLE IF NOT EXISTS public.staff_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  allowed_tabs jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_users TO authenticated;
GRANT ALL ON public.staff_users TO service_role;

ALTER TABLE public.staff_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only service role can manage staff"
  ON public.staff_users
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);