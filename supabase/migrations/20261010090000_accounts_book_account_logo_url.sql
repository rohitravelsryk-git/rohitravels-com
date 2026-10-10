-- Store the optional public logo image URL for each bank or wallet account.
-- Safe to run more than once (additive only; no existing data is changed).
alter table public.accounts_book_accounts
  add column if not exists logo_url text;

-- Only accept HTTPS URLs when provided; keep null for automatic brand-logo fallback.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'accounts_book_accounts_logo_url_https_check'
      and conrelid = 'public.accounts_book_accounts'::regclass
  ) then
    alter table public.accounts_book_accounts
      add constraint accounts_book_accounts_logo_url_https_check
      check (logo_url is null or logo_url ~* '^https://');
  end if;
end $$;

-- Make the API see the new column immediately (otherwise saves fail with
-- "Could not find the 'logo_url' column ... in the schema cache").
notify pgrst, 'reload schema';
