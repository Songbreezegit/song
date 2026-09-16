-- Upgrade existing Backend V1 installations without replacing content or the initial migration.
begin;
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
revoke all on public.admin_users from public, anon, authenticated;
grant select on public.admin_users to authenticated;
-- Membership is provisioned only through trusted database administration.
create policy "Users can verify own admin membership" on public.admin_users
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Admin can view all projects" on public.projects;
drop policy if exists "Admin can insert projects" on public.projects;
drop policy if exists "Admin can update projects" on public.projects;
drop policy if exists "Admin can delete projects" on public.projects;
alter table public.projects enable row level security;
revoke all on public.projects from public, anon, authenticated;
grant select on public.projects to anon;
grant select, insert, update, delete on public.projects to authenticated;
create policy "Verified admin manages projects" on public.projects
  for all to authenticated using (exists (select 1 from public.admin_users where user_id = (select auth.uid()))) with check (exists (select 1 from public.admin_users where user_id = (select auth.uid())));
drop policy if exists "Admin can view all articles" on public.articles;
drop policy if exists "Admin can insert articles" on public.articles;
drop policy if exists "Admin can update articles" on public.articles;
drop policy if exists "Admin can delete articles" on public.articles;
alter table public.articles enable row level security;
revoke all on public.articles from public, anon, authenticated;
grant select on public.articles to anon;
grant select, insert, update, delete on public.articles to authenticated;
create policy "Verified admin manages articles" on public.articles
  for all to authenticated using (exists (select 1 from public.admin_users where user_id = (select auth.uid()))) with check (exists (select 1 from public.admin_users where user_id = (select auth.uid())));
drop policy if exists "Admin can modify site settings" on public.site_settings;
alter table public.site_settings enable row level security;
revoke all on public.site_settings from public, anon, authenticated;
grant select on public.site_settings to anon;
grant select, insert, update, delete on public.site_settings to authenticated;
create policy "Verified admin manages site settings" on public.site_settings
  for all to authenticated using (exists (select 1 from public.admin_users where user_id = (select auth.uid()))) with check (exists (select 1 from public.admin_users where user_id = (select auth.uid())));
drop policy if exists "Admin insert media" on storage.objects;
drop policy if exists "Admin update media" on storage.objects;
drop policy if exists "Admin delete media" on storage.objects;
create policy "Verified admin manages media" on storage.objects
  for all to authenticated
  using (bucket_id = 'media' and exists (select 1 from public.admin_users where user_id = (select auth.uid())))
  with check (bucket_id = 'media' and exists (select 1 from public.admin_users where user_id = (select auth.uid())));
-- Public read policies remain in place. Public bucket URLs are intentionally public.
update storage.buckets set file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'media';
commit;
