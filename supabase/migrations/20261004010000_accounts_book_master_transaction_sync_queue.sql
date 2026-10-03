create table if not exists public.accounts_book_transaction_sync_jobs (
  scope text primary key default 'accounts_book_transactions',
  status text not null default 'pending' check (status in ('pending','running','synced','failed')),
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  attempts integer not null default 0,
  last_error text
);

alter table public.accounts_book_transaction_sync_jobs enable row level security;

create index if not exists accounts_book_transaction_sync_jobs_status_idx
  on public.accounts_book_transaction_sync_jobs(status, requested_at);

insert into public.accounts_book_transaction_sync_jobs(scope)
values ('accounts_book_transactions')
on conflict (scope) do nothing;

create or replace function public.rohi_queue_accounts_book_sheet_sync()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  insert into public.accounts_book_transaction_sync_jobs(
    scope, status, requested_at, started_at, completed_at, last_error
  )
  values ('accounts_book_transactions', 'pending', now(), null, null, null)
  on conflict (scope) do update
    set status = 'pending',
        requested_at = now(),
        started_at = null,
        completed_at = null,
        last_error = null;
  return coalesce(new, old);
end;
$$;

drop trigger if exists accounts_book_transactions_queue_sheet_sync on public.accounts_book_transactions;
create trigger accounts_book_transactions_queue_sheet_sync
after insert or update or delete on public.accounts_book_transactions
for each row execute function public.rohi_queue_accounts_book_sheet_sync();

alter table public.accounts_book_transactions
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.rohi_touch_accounts_book_transaction_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists accounts_book_transactions_touch_updated_at on public.accounts_book_transactions;
create trigger accounts_book_transactions_touch_updated_at
before update on public.accounts_book_transactions
for each row execute function public.rohi_touch_accounts_book_transaction_updated_at();

update public.accounts_book_transaction_sync_jobs
set status = 'pending', requested_at = now(), started_at = null, completed_at = null, last_error = null
where scope = 'accounts_book_transactions';
