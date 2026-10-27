-- Instant Google Sheet mirroring for Airline Accounts.
--
-- Any INSERT / UPDATE / DELETE on the airline ledger tables marks a queue row
-- dirty and, when the shared token exists in Supabase Vault, fires an
-- authenticated webhook that re-mirrors the committed snapshot to the
-- "Airline Accounts" spreadsheet (1frL5ognuYHdtct0kHonvmORhUZm2IYestxUUCgKZD5Q).
-- The database remains the source of truth; the sheet is a mirror only.
--
-- Owner setup (one time, values are yours to generate - never committed here):
--   select vault.create_secret('<your-own-strong-random-token>', 'airline_sheet_sync_token');
-- and add the SAME value as the app secret AIRLINE_SYNC_HOOK_TOKEN.

do $$
begin
  create extension if not exists pg_net;
exception when others then
  null; -- if pg_net is unavailable, the queue still fills and the app-level sync after each save keeps working
end $$;

create table if not exists public.airline_sheet_sync_queue (
  id int primary key default 1 check (id = 1),
  dirty boolean not null default false,
  changed_at timestamptz,
  last_claimed_at timestamptz,
  updated_at timestamptz not null default now()
);
insert into public.airline_sheet_sync_queue (id) values (1) on conflict (id) do nothing;

alter table public.airline_sheet_sync_queue enable row level security;
revoke all on public.airline_sheet_sync_queue from anon, authenticated;

create or replace function public.notify_airline_sheet_change()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, net, vault
as $$
declare
  v_token text;
begin
  insert into public.airline_sheet_sync_queue (id, dirty, changed_at)
  values (1, true, now())
  on conflict (id) do update
    set dirty = true, changed_at = now(), updated_at = now();

  begin
    if to_regclass('vault.decrypted_secrets') is not null then
      select decrypted_secret into v_token
      from vault.decrypted_secrets
      where name = 'airline_sheet_sync_token'
      limit 1;
    end if;

    if v_token is not null and length(btrim(v_token)) > 0 then
      if to_regproc('net.http_post') is not null then
        perform net.http_post(
          url := 'https://rohitravels.com/api/public/hooks/airline-sheet-sync',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-sync-token', btrim(v_token)
          ),
          body := jsonb_build_object('reason', TG_TABLE_NAME),
          timeout_milliseconds := 8000
        );
      elsif to_regproc('extensions.http_post') is not null then
        perform extensions.http_post(
          url := 'https://rohitravels.com/api/public/hooks/airline-sheet-sync',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-sync-token', btrim(v_token)
          ),
          body := jsonb_build_object('reason', TG_TABLE_NAME),
          timeout_milliseconds := 8000
        );
      end if;
    end if;
  exception when others then
    -- Never block or fail a financial write because the mirror hiccuped.
    null;
  end;

  return null;
end;
$$;

drop trigger if exists airline_sheet_sync_transactions on public.airline_ledger_transactions;
create trigger airline_sheet_sync_transactions
after insert or update or delete on public.airline_ledger_transactions
for each statement execute function public.notify_airline_sheet_change();

drop trigger if exists airline_sheet_sync_airlines on public.airline_ledger_airlines;
create trigger airline_sheet_sync_airlines
after insert or update or delete on public.airline_ledger_airlines
for each statement execute function public.notify_airline_sheet_change();

drop trigger if exists airline_sheet_sync_agents on public.airline_ledger_agents;
create trigger airline_sheet_sync_agents
after insert or update or delete on public.airline_ledger_agents
for each statement execute function public.notify_airline_sheet_change();

-- Optional one-minute catch-up: if a webhook was missed (quota, network), the
-- mirror self-heals within a minute instead of waiting for the next edit.
do $$
begin
  if to_regproc('cron.schedule') is not null or exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule('airline-sheet-sync-catchup');
    perform cron.schedule(
      'airline-sheet-sync-catchup',
      '0 * * * *',
      $cron$
      do $job$
      begin
        if to_regproc('net.http_post') is not null then
          perform net.http_post(
            url := 'https://rohitravels.com/api/public/hooks/airline-sheet-sync',
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'x-sync-token', coalesce(
                (select decrypted_secret from vault.decrypted_secrets where name = 'airline_sheet_sync_token' limit 1),
                ''
              )
            ),
            body := jsonb_build_object('reason', 'cron-catchup'),
            timeout_milliseconds := 8000
          );
        end if;
      end;
      $job$;
      $cron$
    );
  end if;
exception when others then
  null; -- catch-up is best-effort; instant triggers and app-level sync remain
end $$;
