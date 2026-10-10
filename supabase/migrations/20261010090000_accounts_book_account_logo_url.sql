-- Store the optional public logo image URL for each bank or wallet account.
alter table public.accounts_book_accounts
  add column if not exists logo_url text;

-- Only accept HTTPS URLs when provided; keep null for automatic brand-logo fallback.
alter table public.accounts_book_accounts
  add constraint accounts_book_accounts_logo_url_https_check
  check (logo_url is null or logo_url ~* '^https://');
