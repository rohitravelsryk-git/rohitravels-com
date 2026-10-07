alter table public.agent_bookings enable row level security;

create policy "Agents can view their own bookings"
  on public.agent_bookings
  for select
  to authenticated
  using ((select auth.uid()) = agent_user_id);

create policy "Agents can create their own bookings"
  on public.agent_bookings
  for insert
  to authenticated
  with check ((select auth.uid()) = agent_user_id);

create policy "Agents can update their own bookings"
  on public.agent_bookings
  for update
  to authenticated
  using ((select auth.uid()) = agent_user_id)
  with check ((select auth.uid()) = agent_user_id);

create policy "Agents can delete their own bookings"
  on public.agent_bookings
  for delete
  to authenticated
  using ((select auth.uid()) = agent_user_id);
