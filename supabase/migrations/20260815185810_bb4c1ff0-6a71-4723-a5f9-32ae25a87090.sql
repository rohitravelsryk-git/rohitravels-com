
create table public.b2b_sticky_notes (
    id uuid primary key default gen_random_uuid(),
    content text not null,
    is_enabled boolean not null default true,
    updated_at timestamptz not null default now()
);

grant select on public.b2b_sticky_notes to authenticated;
grant select on public.b2b_sticky_notes to anon;
grant all on public.b2b_sticky_notes to service_role;

alter table public.b2b_sticky_notes enable row level security;

create policy "Anyone can read enabled sticky notes"
on public.b2b_sticky_notes
for select
to authenticated, anon
using (is_enabled = true);

-- Seed with an initial sample note
insert into public.b2b_sticky_notes (content, is_enabled) values ('Welcome to Rohi International B2B Portal. Confidential credentials and instructions will appear here.', true);
