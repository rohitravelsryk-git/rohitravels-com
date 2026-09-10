-- ROHI Accounts Book: agency-level cash, bank, sales and expense ledgers.
create table if not exists public.accounts_book_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'bank' check (kind in ('cash', 'bank', 'wallet')),
  opening_balance numeric not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.accounts_book_transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts_book_accounts(id) on delete restrict,
  entry_date date not null default current_date,
  entry_type text not null check (entry_type in ('sale', 'expense', 'transfer', 'manual')),
  category text not null default 'General',
  party text,
  description text not null,
  amount numeric not null check (amount > 0),
  direct_cost numeric not null default 0 check (direct_cost >= 0),
  direction text not null default 'in' check (direction in ('in', 'out')),
  source_type text,
  source_id uuid,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists accounts_book_transactions_account_date_idx
  on public.accounts_book_transactions(account_id, entry_date, created_at);

alter table public.accounts_book_accounts enable row level security;
alter table public.accounts_book_transactions enable row level security;

-- The application writes through the existing server-side admin gate.
-- Keep direct browser access closed until a user-specific policy is deliberately added.
revoke all on public.accounts_book_accounts from anon, authenticated;
revoke all on public.accounts_book_transactions from anon, authenticated;
grant all on public.accounts_book_accounts to service_role;
grant all on public.accounts_book_transactions to service_role;

do $$
begin
  if not exists (select 1 from public.accounts_book_accounts where kind = 'cash') then
    insert into public.accounts_book_accounts (name, kind, opening_balance)
    values ('Cash in hand', 'cash', 0);
  end if;
end $$;