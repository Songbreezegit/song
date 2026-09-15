-- ==============================================================================
-- 松屿 · SONG ISLE Backend V1 Database Schema Migration
-- ==============================================================================

-- 1. Create content_status enum if not exists
do $$
begin
  if not exists (select 1 from pg_type where typname = 'content_status') then
    create type content_status as enum ('draft', 'published', 'archived');
  end if;
end$$;

-- 2. Projects Table
create table if not exists public.projects (
  id text primary key default gen_random_uuid()::text,
  slug text not null unique,
  title text not null,
  subtitle text not null default '',
  category text not null default 'web',
  category_label text not null default '',
  year text not null default '',
  featured boolean not null default false,
  tagline text not null default '',
  description text not null default '',
  tech_stack text[] not null default '{}',
  github_url text not null default '',
  live_url text default '',
  cover_image text default '',
  image_theme jsonb not null default '{"bgColor":"#0F172A","accentColor":"#38BDF8","type":"browser"}'::jsonb,
  overview text not null default '',
  features text[] not null default '{}',
  development_notes text not null default '',
  challenges_solutions jsonb not null default '[]'::jsonb,
  status content_status not null default 'draft',
  sort_order integer not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_projects_status on public.projects(status);
create index if not exists idx_projects_slug on public.projects(slug);
create index if not exists idx_projects_sort on public.projects(sort_order asc, created_at desc);

-- 3. Articles Table
create table if not exists public.articles (
  id text primary key default gen_random_uuid()::text,
  slug text not null unique,
  title text not null,
  subtitle text not null default '',
  date text not null default '',
  year text not null default '',
  category text not null default '思考',
  category_slug text not null default 'notes',
  tags text[] not null default '{}',
  read_time text not null default '3 min',
  excerpt text not null default '',
  content jsonb not null default '{"lead":"","sections":[]}'::jsonb,
  status content_status not null default 'draft',
  sort_order integer not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_articles_status on public.articles(status);
create index if not exists idx_articles_slug on public.articles(slug);
create index if not exists idx_articles_sort on public.articles(sort_order asc, created_at desc);

-- 4. Site Settings Table
create table if not exists public.site_settings (
  id text primary key default 'default',
  site_intro text not null default '',
  currently jsonb not null default '{}'::jsonb,
  based_in text not null default '',
  contact jsonb not null default '{}'::jsonb,
  about jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 5. Enable Row Level Security (RLS)
alter table public.projects enable row level security;
alter table public.articles enable row level security;
alter table public.site_settings enable row level security;

-- 6. RLS Policies: Projects
-- Public read only published projects
create policy "Public can view published projects"
  on public.projects for select
  using (status = 'published');

-- Authenticated admin full management
create policy "Admin can view all projects"
  on public.projects for select
  to authenticated
  using (true);

create policy "Admin can insert projects"
  on public.projects for insert
  to authenticated
  with check (true);

create policy "Admin can update projects"
  on public.projects for update
  to authenticated
  using (true)
  with check (true);

create policy "Admin can delete projects"
  on public.projects for delete
  to authenticated
  using (true);

-- 7. RLS Policies: Articles
-- Public read only published articles
create policy "Public can view published articles"
  on public.articles for select
  using (status = 'published');

-- Authenticated admin full management
create policy "Admin can view all articles"
  on public.articles for select
  to authenticated
  using (true);

create policy "Admin can insert articles"
  on public.articles for insert
  to authenticated
  with check (true);

create policy "Admin can update articles"
  on public.articles for update
  to authenticated
  using (true)
  with check (true);

create policy "Admin can delete articles"
  on public.articles for delete
  to authenticated
  using (true);

-- 8. RLS Policies: Site Settings
-- Public read site settings
create policy "Public can view site settings"
  on public.site_settings for select
  using (true);

-- Authenticated admin manage site settings
create policy "Admin can modify site settings"
  on public.site_settings for all
  to authenticated
  using (true)
  with check (true);

-- 9. Storage Setup (Bucket: media)
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

create policy "Public read media"
  on storage.objects for select
  using (bucket_id = 'media');

create policy "Admin insert media"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'media');

create policy "Admin update media"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'media');

create policy "Admin delete media"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'media');
