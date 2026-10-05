-- Add a persisted display order for Banks & Wallets accounts and for Sales /
-- Expense service categories, so the admin panel's pill lists can be
-- reordered by drag-and-drop and keep that order across reloads.

alter table public.accounts_book_accounts
  add column if not exists sort_order integer not null default 0;

alter table public.accounts_book_services
  add column if not exists sort_order integer not null default 0;

-- Backfill existing rows with their current effective order (by creation
-- time, matching how they display today) so nothing visually jumps around
-- the first time this ships.
with ranked as (
  select id, row_number() over (order by created_at) as rn
  from public.accounts_book_accounts
)
update public.accounts_book_accounts a
set sort_order = ranked.rn
from ranked
where ranked.id = a.id and a.sort_order = 0;

with ranked as (
  select id, row_number() over (order by name) as rn
  from public.accounts_book_services
)
update public.accounts_book_services s
set sort_order = ranked.rn
from ranked
where ranked.id = s.id and s.sort_order = 0;

notify pgrst, 'reload schema';
