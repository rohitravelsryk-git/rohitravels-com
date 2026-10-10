-- Keep the Addons Banks & Wallets master list aligned with Accounts Book.
-- Website URLs are no longer part of the Addons data model.
alter table public.bank_wallet_addons drop column if exists website_url;

-- Seed existing bank and wallet accounts, preserving custom logo URLs already set in Addons.
-- The Accounts Book account "BAH" is Bank Al Habib, so it maps onto the full-name Addons entry
-- instead of creating a second, differently named row.
with src as (
  select
    case when lower(trim(a.name)) = 'bah' then 'Bank Al Habib (BAH)' else trim(a.name) end as name,
    a.kind,
    a.logo_url,
    a.created_at
  from public.accounts_book_accounts a
  where a.kind in ('bank', 'wallet')
    and a.is_active = true
    and trim(a.name) <> ''
), dedup as (
  select distinct on (lower(name)) name, kind, logo_url
  from src
  order by lower(name), created_at asc
)
insert into public.bank_wallet_addons (name, kind, logo_url, sort_order)
select name, kind, logo_url, row_number() over (order by lower(name)) * 10
from dedup
on conflict (lower(name)) do update
set kind = excluded.kind,
    logo_url = coalesce(public.bank_wallet_addons.logo_url, excluded.logo_url),
    updated_at = now();

notify pgrst, 'reload schema';
