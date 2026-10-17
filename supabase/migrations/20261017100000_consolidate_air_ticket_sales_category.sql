-- Consolidate the overlapping ticket-sales categories into ONE "Air Ticket"
-- category. Existing transactions are re-categorised, never deleted; history,
-- reports and per-category tabs (Visa Processing, Insurance, ...) are untouched.
-- Run in the Supabase SQL editor (as postgres) or via migration.

-- 1. Make sure "Air Ticket" exists as a sales category.
insert into public.accounts_book_services (name)
select 'Air Ticket'
where not exists (
  select 1 from public.accounts_book_services
  where lower(trim(name)) = 'air ticket'
);

-- 2. Re-categorise the duplicates into "Air Ticket" (no entry is lost).
update public.accounts_book_transactions
set category = 'Air Ticket'
where lower(trim(category)) in ('counter sales', 'sales account', 'sales accounts');

-- 3. Remove the now-empty duplicate categories.
delete from public.accounts_book_services
where lower(trim(name)) in ('counter sales', 'sales account', 'sales accounts');
