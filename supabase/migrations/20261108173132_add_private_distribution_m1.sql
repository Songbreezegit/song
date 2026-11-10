-- REVIEW ONLY: apply to production only after the owner explicitly approves.
-- Prerequisites: current projects/admin_users/storage + existing MFA migration.
begin;

create schema if not exists distribution_private;
revoke all on schema distribution_private from public, anon, authenticated;
grant usage on schema distribution_private to authenticated;

create table if not exists public.distribution_accounts (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('xiaohongshu','douyin','bilibili','wechat','weibo','zhihu','x','youtube','other')),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  profile_url text not null default '' check (char_length(profile_url) <= 2048 and
    (profile_url = '' or (profile_url ~ '^https?://[^/?#[:space:]@\\]+([/?#][^[:space:]\\]*)?$' and profile_url !~ '[[:cntrl:]]'))),
  account_type text not null default 'personal' check (account_type in ('personal','project')),
  positioning text not null default '' check (char_length(positioning) <= 1000),
  project_id text references public.projects(id) on delete set null,
  notes text not null default '' check (char_length(notes) <= 5000),
  is_enabled boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  constraint distribution_archived_disabled check (archived_at is null or not is_enabled)
);

create table if not exists public.distribution_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  body text not null default '' check (char_length(body) <= 100000),
  tags text[] not null default '{}' check (cardinality(tags) <= 20),
  content_type text not null default 'image_text' check (content_type in ('image_text','video','article','moment')),
  project_id text references public.projects(id) on delete set null,
  promotion_goal text not null default 'awareness' check (promotion_goal in ('awareness','project_visit','download','community')),
  -- No published state or schedule: preparation cannot assert external success.
  status text not null default 'draft' check (status in ('draft','ready')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0)
);

create table if not exists public.distribution_post_targets (
  post_id uuid not null references public.distribution_posts(id) on delete cascade,
  account_id uuid not null references public.distribution_accounts(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (post_id, account_id)
);

create table if not exists public.distribution_post_media (
  post_id uuid not null references public.distribution_posts(id) on delete cascade,
  media_id uuid not null references storage.objects(id) on delete restrict,
  sort_order integer not null check (sort_order between 0 and 19),
  created_at timestamptz not null default now(),
  primary key (post_id, media_id),
  unique (post_id, sort_order) deferrable initially deferred
);

create index if not exists distribution_accounts_project_idx on public.distribution_accounts(project_id);
create index if not exists distribution_accounts_platform_idx on public.distribution_accounts(platform, archived_at);
create index if not exists distribution_accounts_updated_idx on public.distribution_accounts(updated_at desc, id);
create index if not exists distribution_posts_project_idx on public.distribution_posts(project_id);
create index if not exists distribution_posts_status_updated_idx on public.distribution_posts(status, updated_at desc, id);
create index if not exists distribution_posts_updated_idx on public.distribution_posts(updated_at desc, id);
create index if not exists distribution_targets_account_idx on public.distribution_post_targets(account_id);
create index if not exists distribution_media_object_idx on public.distribution_post_media(media_id);

create or replace function distribution_private.touch_record() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_table_name = 'distribution_accounts' then
    if tg_op = 'UPDATE' and old.archived_at is not null then
      -- The projects FK can clear its reference after the parent is deleted.
      if pg_trigger_depth() <= 1 or old.project_id is null or new.project_id is not null
        or (to_jsonb(new) - 'project_id') is distinct from (to_jsonb(old) - 'project_id')
        or exists (select 1 from public.projects where id = old.project_id)
      then raise exception 'Archived distribution account is read-only' using errcode = '55000'; end if;
    elsif new.archived_at is not null then
      new.archived_at := clock_timestamp();
      new.is_enabled := false;
    end if;
  end if;
  if tg_op = 'INSERT' then
    new.created_at := clock_timestamp(); new.version := 1;
  else
    if new.id is distinct from old.id then raise exception 'Record identity is immutable' using errcode = '22023'; end if;
    new.created_at := old.created_at; new.version := old.version + 1;
  end if;
  new.updated_at := clock_timestamp();
  if tg_table_name = 'distribution_posts' then
    if (array_ndims(new.tags) is not null and array_ndims(new.tags) <> 1)
      or exists (select 1 from unnest(new.tags) tag where tag is null or char_length(btrim(tag)) not between 1 and 50)
      or (select count(distinct tag) from unnest(new.tags) tag) <> cardinality(new.tags)
    then raise exception 'Invalid tags' using errcode = '22023'; end if;
  end if;
  return new;
end $$;

create or replace function distribution_private.check_relation() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_table_name = 'distribution_post_targets' then
    -- SHARE serializes with archive/disable; existing historical targets remain.
    perform 1 from public.distribution_accounts where id = new.account_id and archived_at is null and is_enabled for share;
    if not found then raise exception 'Choose an enabled, unarchived account' using errcode = '23503'; end if;
  else
    perform 1 from storage.objects where id = new.media_id and bucket_id = 'media' for key share;
    if not found then raise exception 'Choose an existing media object from the media bucket' using errcode = '23503'; end if;
  end if;
  return new;
end $$;

revoke all on function distribution_private.touch_record(), distribution_private.check_relation() from public, anon, authenticated;

drop trigger if exists distribution_account_touch on public.distribution_accounts;
create trigger distribution_account_touch before insert or update on public.distribution_accounts for each row execute function distribution_private.touch_record();
drop trigger if exists distribution_post_touch on public.distribution_posts;
create trigger distribution_post_touch before insert or update on public.distribution_posts for each row execute function distribution_private.touch_record();
drop trigger if exists distribution_target_check on public.distribution_post_targets;
create trigger distribution_target_check before insert or update on public.distribution_post_targets for each row execute function distribution_private.check_relation();
drop trigger if exists distribution_media_check on public.distribution_post_media;
create trigger distribution_media_check before insert or update on public.distribution_post_media for each row execute function distribution_private.check_relation();

do $$
declare target regclass; label text;
begin
  for target, label in select * from (values
    ('public.distribution_accounts'::regclass, 'accounts'), ('public.distribution_posts'::regclass, 'posts'),
    ('public.distribution_post_targets'::regclass, 'targets'), ('public.distribution_post_media'::regclass, 'media')
  ) tables(relation, name) loop
    execute format('alter table %s enable row level security', target);
    execute format('alter table %s force row level security', target);
    execute format('revoke all on %s from public, anon, authenticated', target);
    execute format('grant select, insert, update, delete on %s to authenticated', target);
    execute format('drop policy if exists %I on %s', 'Distribution admin ' || label, target);
    execute format('drop policy if exists %I on %s', 'Distribution MFA boundary ' || label, target);
    execute format('create policy %I on %s for all to authenticated using (exists (select 1 from public.admin_users where user_id = (select auth.uid()))) with check (exists (select 1 from public.admin_users where user_id = (select auth.uid())))', 'Distribution admin ' || label, target);
    -- A permissive policy accidentally added later cannot open these tables.
    execute format('create policy %I on %s as restrictive for all to authenticated using ((select auth.jwt()->>''aal'') = ''aal2'' and exists (select 1 from public.admin_users where user_id = (select auth.uid()))) with check ((select auth.jwt()->>''aal'') = ''aal2'' and exists (select 1 from public.admin_users where user_id = (select auth.uid())))', 'Distribution MFA boundary ' || label, target);
  end loop;
end $$;

-- Accounts have archive-only removal. Only source drafts can be deleted.
revoke delete on public.distribution_accounts from authenticated;
drop policy if exists "Distribution draft deletion" on public.distribution_posts;
create policy "Distribution draft deletion" on public.distribution_posts as restrictive for delete to authenticated using (status = 'draft');

create or replace function public.save_distribution_post(p_id uuid, p_version integer, p_post jsonb, p_account_ids uuid[], p_media_ids uuid[])
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare saved public.distribution_posts; input public.distribution_posts;
begin
  if (select auth.uid()) is null or coalesce((select auth.jwt()->>'aal'), '') <> 'aal2'
    or not exists (select 1 from public.admin_users where user_id = (select auth.uid()))
  then raise exception 'MFA-verified site administrator required' using errcode = '42501'; end if;
  if p_id is null or (p_version is not null and p_version < 1) or jsonb_typeof(p_post) is distinct from 'object'
    or octet_length(p_post::text) > 524288
    or not p_post ?& array['title','body','tags','content_type','project_id','promotion_goal','status']
    or exists (select 1 from jsonb_object_keys(p_post) k where k <> all(array['title','body','tags','content_type','project_id','promotion_goal','status']))
  then raise exception 'Invalid post payload' using errcode = '22023'; end if;
  if exists (select 1 from jsonb_each(p_post) e where e.key in ('title','body','content_type','promotion_goal','status') and jsonb_typeof(e.value) <> 'string')
    or jsonb_typeof(p_post->'tags') <> 'array'
    or jsonb_typeof(p_post->'project_id') not in ('string','null')
  then raise exception 'Invalid post field types' using errcode = '22023'; end if;
  if exists (select 1 from jsonb_array_elements(p_post->'tags') tag where jsonb_typeof(tag) <> 'string') then
    raise exception 'Invalid tags' using errcode = '22023'; end if;
  if p_account_ids is null or p_media_ids is null or cardinality(p_account_ids) > 50 or cardinality(p_media_ids) > 20
    or coalesce(array_ndims(p_account_ids), 1) <> 1 or coalesce(array_ndims(p_media_ids), 1) <> 1
    or (select count(distinct id) from unnest(p_account_ids) id) <> cardinality(p_account_ids)
    or (select count(distinct id) from unnest(p_media_ids) id) <> cardinality(p_media_ids)
  then raise exception 'Invalid relation identifiers' using errcode = '22023'; end if;
  input := jsonb_populate_record(null::public.distribution_posts, p_post);
  if p_version is null then
    insert into public.distribution_posts(id,title,body,tags,content_type,project_id,promotion_goal,status)
      values(p_id,input.title,input.body,input.tags,input.content_type,input.project_id,input.promotion_goal,input.status) returning * into saved;
  else
    update public.distribution_posts set title=input.title,body=input.body,tags=input.tags,content_type=input.content_type,
      project_id=input.project_id,promotion_goal=input.promotion_goal,status=input.status where id=p_id and version=p_version returning * into saved;
    if not found then raise exception 'Post changed or is no longer accessible; reload before saving' using errcode = '40001'; end if;
  end if;
  delete from public.distribution_post_targets where post_id=p_id and not (account_id = any(p_account_ids));
  insert into public.distribution_post_targets(post_id,account_id) select p_id,id from unnest(p_account_ids) id
    where not exists(select 1 from public.distribution_post_targets t where t.post_id=p_id and t.account_id=id);
  delete from public.distribution_post_media where post_id=p_id and not (media_id = any(p_media_ids));
  insert into public.distribution_post_media(post_id,media_id,sort_order) select p_id,id,ordinality-1 from unnest(p_media_ids) with ordinality m(id,ordinality)
    on conflict (post_id,media_id) do update set sort_order=excluded.sort_order;
  return to_jsonb(saved) || jsonb_build_object('account_ids',to_jsonb(p_account_ids),'media_ids',to_jsonb(p_media_ids));
end $$;
revoke all on function public.save_distribution_post(uuid,integer,jsonb,uuid[],uuid[]) from public, anon, authenticated;
grant execute on function public.save_distribution_post(uuid,integer,jsonb,uuid[],uuid[]) to authenticated;

comment on table public.distribution_posts is 'Private canonical distribution sources; ready means prepared, never externally published.';
comment on table public.distribution_accounts is 'Public account metadata only. No passwords, cookies, sessions or OAuth tokens.';
comment on function public.save_distribution_post(uuid,integer,jsonb,uuid[],uuid[]) is 'Invoker RPC; atomically saves source + target accounts + ordered existing media under admin+aal2 RLS.';
commit;
