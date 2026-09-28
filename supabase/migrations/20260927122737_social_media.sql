-- Social media connected accounts (Marketing Studio → Social Media tab)
create table if not exists public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('facebook', 'instagram', 'twitter', 'linkedin', 'whatsapp')),
  label text not null,
  credentials jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  last_status text,
  last_error text,
  last_posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.social_accounts enable row level security;
revoke all on public.social_accounts from anon, authenticated;
grant all on public.social_accounts to service_role;

-- Log of every "post to all" action and the per-platform outcome
create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  image_url text,
  source text not null default 'manual' check (source in ('manual', 'group_fares', 'saved_campaign', 'email_marketing')),
  results jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.social_posts enable row level security;
revoke all on public.social_posts from anon, authenticated;
grant all on public.social_posts to service_role;

create index if not exists social_posts_created_at_idx on public.social_posts (created_at desc);
