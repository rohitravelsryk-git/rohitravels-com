-- Migration: Create vendors and vendor_ledger tables matching Google Sheets Addons structure

create table if not exists public.vendors (
    id uuid primary key default gen_random_uuid(),
    vendor_code text unique not null,
    name text not null,
    category text default 'Airline / GDS',
    contact_person text,
    phone text,
    email text,
    city text,
    opening_balance numeric(12,2) not null default 0.00,
    current_balance numeric(12,2) not null default 0.00,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.vendor_ledger (
    id uuid primary key default gen_random_uuid(),
    vendor_id uuid references public.vendors(id) on delete cascade,
    transaction_date date not null default current_date,
    reference_no text,
    description text,
    debit numeric(12,2) not null default 0.00,
    credit numeric(12,2) not null default 0.00,
    balance numeric(12,2) not null default 0.00,
    created_at timestamptz not null default now()
);

grant all on public.vendors to authenticated, anon, service_role;
grant all on public.vendor_ledger to authenticated, anon, service_role;

alter table public.vendors enable row level security;
alter table public.vendor_ledger enable row level security;

drop policy if exists "Allow read vendors" on public.vendors;
create policy "Allow read vendors" on public.vendors for select to authenticated, anon using (true);

drop policy if exists "Allow write vendors" on public.vendors;
create policy "Allow write vendors" on public.vendors for all to authenticated, anon using (true) with check (true);

drop policy if exists "Allow read vendor_ledger" on public.vendor_ledger;
create policy "Allow read vendor_ledger" on public.vendor_ledger for select to authenticated, anon using (true);

drop policy if exists "Allow write vendor_ledger" on public.vendor_ledger;
create policy "Allow write vendor_ledger" on public.vendor_ledger for all to authenticated, anon using (true) with check (true);

-- Seed initial vendor records matching Google Sheets
insert into public.vendors (vendor_code, name, category, contact_person, phone, email, city, opening_balance, current_balance)
values 
  ('VND-1001', 'Airblue Direct Portal', 'Airline / GDS', 'Sales Desk', '0300 0000000', 'support@airblue.com', 'Islamabad', 0.00, 0.00),
  ('VND-1002', 'Muqeem Portal Services', 'Visa / Portal', 'Portal Admin', '0300 0000001', 'support@muqeem.sa', 'Riyadh', 0.00, 0.00)
on conflict (vendor_code) do nothing;
