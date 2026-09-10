create table if not exists public.accounts_book_services (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.accounts_book_services enable row level security;
revoke all on public.accounts_book_services from anon, authenticated;
grant all on public.accounts_book_services to service_role;

insert into public.accounts_book_services (name)
select name from unnest(array[
  'Counter Sales', 'Saudia Visa Process', 'KV Visit Visa', 'Group Tickets',
  'Umrah', 'Insurance', 'Protect', 'Appointments', 'Refunds'
]) as defaults(name)
where not exists (select 1 from public.accounts_book_services);
