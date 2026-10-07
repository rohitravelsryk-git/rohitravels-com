-- Agents: browser access is limited to the signed-in agent's own record.
revoke all on table public.agents from anon, authenticated;
grant select, update on table public.agents to authenticated;
drop policy if exists "Allow admin update agents" on public.agents;
drop policy if exists "Allow read agents" on public.agents;

create policy "Agents can view their own profile"
  on public.agents
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Agents can update their own profile"
  on public.agents
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- These ledgers are server-only; browser clients must use authorized server functions.
revoke all on table public.airline_ledger_agents from anon, authenticated;
drop policy if exists "Allow manage airline_ledger_agents" on public.airline_ledger_agents;
drop policy if exists "Allow read airline_ledger_agents" on public.airline_ledger_agents;

-- Sticky notes are also server-managed.
revoke all on table public.b2b_sticky_notes from anon, authenticated;
drop policy if exists "Anyone can read enabled sticky notes" on public.b2b_sticky_notes;
drop policy if exists "Anyone can update sticky notes" on public.b2b_sticky_notes;

-- Vendor master and ledger data are admin/server-only.
revoke all on table public.vendors, public.vendor_ledger from anon, authenticated;
drop policy if exists "Allow read vendors" on public.vendors;
drop policy if exists "Allow write vendors" on public.vendors;
drop policy if exists "Allow read vendor_ledger" on public.vendor_ledger;
drop policy if exists "Allow write vendor_ledger" on public.vendor_ledger;

-- Keep the single intended public fare-read policy; remove the unrestricted duplicate.
drop policy if exists "allow_read_fares" on public.fares;

-- Vouchers are server-managed and must not be directly exposed through the Data API.
revoke all on table public.vouchers from anon, authenticated;
drop policy if exists "No direct public voucher access" on public.vouchers;
drop policy if exists "allow_read_vouchers" on public.vouchers;
