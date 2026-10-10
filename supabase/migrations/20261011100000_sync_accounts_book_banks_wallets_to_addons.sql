-- Keep the Addons Banks & Wallets master list aligned with Accounts Book.
-- Website URLs are no longer part of the Addons data model.
alter table public.bank_wallet_addons drop column if exists website_url;

-- Seed existing bank and wallet accounts, preserving custom logo URLs already set in Addons.
insert into public.bank_wallet_addons (name, kind, logo_url, sort_order)
select distinct on (lower(trim(a.name)))
  trim(a.name),
  a.kind,
  a.logo_url,
  row_number() over (order by lower(trim(a.name))) * 10
from public.accounts_book_accounts a
where a.kind in ('bank', 'wallet')
  and a.is_active = true
  and trim(a.name) <> ''
order by lower(trim(a.name)), a.created_at asc
on conflict (lower(name)) do update
set kind = excluded.kind,
    logo_url = coalesce(public.bank_wallet_addons.logo_url, excluded.logo_url),
    updated_at = now();

notify pgrst, 'reload schema';
