-- Master list of banks & wallets for the admin Addons page (name, website, logo).
-- Additive only: creates one new table; no existing table or data is touched.
-- Server-only access: RLS on, no anon/authenticated access; the admin UI reads and
-- writes through server functions using the service role.
create table if not exists public.bank_wallet_addons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'bank' check (kind in ('bank', 'wallet')),
  website_url text,
  logo_url text,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bank_wallet_addons_website_https check (website_url is null or website_url ~* '^https://'),
  constraint bank_wallet_addons_logo_https check (logo_url is null or logo_url ~* '^https://')
);

create unique index if not exists bank_wallet_addons_name_uidx
  on public.bank_wallet_addons (lower(name));

alter table public.bank_wallet_addons enable row level security;

revoke all on public.bank_wallet_addons from anon, authenticated;
grant all on public.bank_wallet_addons to service_role;

drop policy if exists "service_role_all_bank_wallet_addons" on public.bank_wallet_addons;
create policy "service_role_all_bank_wallet_addons" on public.bank_wallet_addons
  for all to service_role using (true) with check (true);

notify pgrst, 'reload schema';
