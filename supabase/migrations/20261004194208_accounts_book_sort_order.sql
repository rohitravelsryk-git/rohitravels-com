-- Lets the Banks & Wallets, Sales Category and Expense Category pill bars in
-- /admin/accounts-book be drag-reordered, with the order persisted per row.
alter table public.accounts_book_accounts
  add column if not exists sort_order integer not null default 0;

alter table public.accounts_book_services
  add column if not exists sort_order integer not null default 0;

-- Seed sort_order from existing creation order so current pill order is
-- preserved on first load (nothing visually jumps around).
with ranked as (
  select id, row_number() over (order by created_at) as rn
  from public.accounts_book_accounts
)
update public.accounts_book_accounts a
set sort_order = ranked.rn
from ranked
where a.id = ranked.id and a.sort_order = 0;

with ranked as (
  select id, row_number() over (order by name) as rn
  from public.accounts_book_services
)
update public.accounts_book_services s
set sort_order = ranked.rn
from ranked
where s.id = ranked.id and s.sort_order = 0;

notify pgrst, 'reload schema';
