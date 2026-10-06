-- Defense-in-depth for Accounts Book and public read-only reference data.
-- Ledger-bearing accounts must be archived, never permanently deleted.
-- Public reference tables remain readable but are not writable from anon/authenticated clients.
-- PostgREST schema cache is explicitly reloaded after these grants.

create or replace function public.prevent_accounts_book_account_delete_with_ledger()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.accounts_book_transactions t
    where t.account_id = old.id
  ) then
    raise exception using
      errcode = '23503',
      message = 'Account cannot be permanently deleted because it has ledger entries. Archive the account instead so transaction history and transfer pairs remain intact.';
  end if;
  return old;
end;
$$;

drop trigger if exists accounts_book_prevent_account_delete_with_ledger
  on public.accounts_book_accounts;

create trigger accounts_book_prevent_account_delete_with_ledger
before delete on public.accounts_book_accounts
for each row
execute function public.prevent_accounts_book_account_delete_with_ledger();

revoke insert, update, delete, truncate
on table
  public.site_settings,
  public.airlines,
  public.fares,
  public.inquiry_services,
  public.visa_verification_links
from anon, authenticated;

grant select
on table
  public.site_settings,
  public.airlines,
  public.fares,
  public.inquiry_services,
  public.visa_verification_links
to anon, authenticated;

notify pgrst, 'reload schema';
