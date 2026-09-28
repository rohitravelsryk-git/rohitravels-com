create table if not exists public.google_sheets_oauth_connections (
  id text primary key default 'default',
  google_email text not null,
  refresh_token_ciphertext text not null,
  spreadsheet_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

revoke all on public.google_sheets_oauth_connections from anon, authenticated;
grant all on public.google_sheets_oauth_connections to service_role;
