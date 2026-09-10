alter table public.accounts_book_accounts
  add column if not exists opening_balance_date date not null default current_date;

create index if not exists accounts_book_accounts_kind_idx
  on public.accounts_book_accounts(kind, is_active);