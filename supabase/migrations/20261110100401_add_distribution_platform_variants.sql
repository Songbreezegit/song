-- M2 staging review. M1 tables, functions and policies keep their existing definitions.
begin;

create table public.distribution_variants (
  id uuid primary key,
  post_id uuid not null references public.distribution_posts(id) on delete cascade,
  account_id uuid not null references public.distribution_accounts(id) on delete restrict,
  platform text not null check (platform in ('xiaohongshu','douyin','bilibili','wechat','weibo','zhihu','x','youtube','other')),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  body text not null check (char_length(body) <= 100000),
  tags text[] not null check (cardinality(tags) <= 20),
  content_type text not null check (content_type in ('image_text','video','article','moment')),
  status text not null check (status in ('draft','ready')),
  source_version integer not null check (source_version > 0),
  source_snapshot jsonb not null check (jsonb_typeof(source_snapshot) = 'object'),
  version integer not null check (version > 0),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  -- The aggregate gets one revision per transaction, including direct media edits.
  write_xid xid8 not null,
  unique (post_id, account_id)
);
create index distribution_variants_account_idx on public.distribution_variants(account_id);

create table public.distribution_variant_media (
  variant_id uuid not null references public.distribution_variants(id) on delete cascade,
  media_id uuid not null references storage.objects(id) on delete restrict,
  sort_order integer not null check (sort_order between 0 and 19),
  is_cover boolean not null default false,
  aspect_ratio_hint text not null default '' check (aspect_ratio_hint in ('','1:1','3:4','4:3','9:16','16:9')),
  processing_notes text not null default '' check (char_length(processing_notes) <= 1000),
  created_at timestamptz not null default clock_timestamp(),
  primary key (variant_id, media_id),
  unique (variant_id, sort_order) deferrable initially deferred
);
create unique index distribution_variant_one_cover on public.distribution_variant_media(variant_id) where is_cover;
create index distribution_variant_media_object_idx on public.distribution_variant_media(media_id);

do $$
declare target regclass; label text;
begin
  for target, label in select * from (values
    ('public.distribution_variants'::regclass, 'variants'),
    ('public.distribution_variant_media'::regclass, 'variant media')
  ) tables(relation, name) loop
    execute format('alter table %s enable row level security', target);
    execute format('alter table %s force row level security', target);
    execute format('revoke all on %s from public, anon, authenticated', target);
    execute format('grant select, insert, update, delete on %s to authenticated', target);
    execute format('create policy %I on %s for all to authenticated using (exists (select 1 from public.admin_users where user_id = (select auth.uid()))) with check (exists (select 1 from public.admin_users where user_id = (select auth.uid())))', 'Distribution admin ' || label, target);
    execute format('create policy %I on %s as restrictive for all to authenticated using ((select auth.jwt()->>''aal'') = ''aal2'' and exists (select 1 from public.admin_users where user_id = (select auth.uid()))) with check ((select auth.jwt()->>''aal'') = ''aal2'' and exists (select 1 from public.admin_users where user_id = (select auth.uid())))', 'Distribution MFA boundary ' || label, target);
  end loop;
end $$;

-- Only the existing draft deletion path may cascade into platform drafts.
revoke delete on public.distribution_variants from authenticated;

create function distribution_private.assert_variant_admin() returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if (select auth.uid()) is null or coalesce((select auth.jwt()->>'aal'), '') <> 'aal2'
    or not exists (select 1 from public.admin_users where user_id = (select auth.uid()))
  then raise exception 'MFA-verified site administrator required' using errcode = '42501'; end if;
end $$;

-- Lock source first, in the same order as the existing source-save transaction.
create function distribution_private.lock_variant_source(p_post uuid, p_account uuid, p_platform text)
returns public.distribution_posts language plpgsql security invoker set search_path = '' as $$
declare source public.distribution_posts; current_platform text;
begin
  select * into source from public.distribution_posts where id = p_post for share;
  if not found then raise exception 'Content source is unavailable' using errcode = '23503'; end if;
  select platform into current_platform from public.distribution_accounts
    where id = p_account and is_enabled and archived_at is null for share;
  if not found or (p_platform is not null and current_platform <> p_platform) then
    raise exception 'Account is inactive or its platform changed' using errcode = 'PT409';
  end if;
  perform 1 from public.distribution_post_targets where post_id = p_post and account_id = p_account for key share;
  if not found then raise exception 'Account is no longer a selected target' using errcode = 'PT409'; end if;
  return source;
end $$;

create function distribution_private.variant_source_snapshot(source public.distribution_posts)
returns jsonb language sql security invoker set search_path = '' as $$
  select jsonb_build_object(
    'title', source.title, 'body', source.body, 'tags', source.tags, 'content_type', source.content_type,
    'media_ids', coalesce((select jsonb_agg(m.media_id order by m.sort_order)
      from public.distribution_post_media m where m.post_id = source.id), '[]'::jsonb)
  );
$$;

create function distribution_private.touch_variant() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare source public.distribution_posts; snapshot jsonb;
begin
  if tg_op = 'INSERT' then
    source := distribution_private.lock_variant_source(new.post_id, new.account_id, null);
    select platform into new.platform from public.distribution_accounts where id = new.account_id;
    new.title := source.title;
    new.body := source.body;
    new.tags := source.tags;
    new.content_type := source.content_type;
    new.status := 'draft';
    new.source_version := source.version;
    new.source_snapshot := distribution_private.variant_source_snapshot(source);
    new.created_at := clock_timestamp();
    new.version := 1;
  else
    if (new.id, new.post_id, new.account_id, new.platform) is distinct from (old.id, old.post_id, old.account_id, old.platform) then
      raise exception 'Variant identity and platform snapshot are immutable' using errcode = '22023';
    end if;
    source := distribution_private.lock_variant_source(old.post_id, old.account_id, old.platform);
    if (new.source_version, new.source_snapshot) is distinct from (old.source_version, old.source_snapshot) then
      snapshot := distribution_private.variant_source_snapshot(source);
      if new.source_version <= old.source_version or new.source_version <> source.version or new.source_snapshot is distinct from snapshot then
        raise exception 'Source changed; reload before syncing' using errcode = 'PT409';
      end if;
      if not (
        (snapshot->'title' is distinct from old.source_snapshot->'title' and new.title = source.title)
        or (snapshot->'body' is distinct from old.source_snapshot->'body' and new.body = source.body)
        or (snapshot->'tags' is distinct from old.source_snapshot->'tags' and new.tags = source.tags)
        or (snapshot->'content_type' is distinct from old.source_snapshot->'content_type' and new.content_type = source.content_type)
        or (snapshot->'media_ids' is distinct from old.source_snapshot->'media_ids' and snapshot->'media_ids' =
          (select coalesce(jsonb_agg(media_id order by sort_order), '[]'::jsonb)
           from public.distribution_variant_media where variant_id = old.id))
      ) then raise exception 'Apply at least one changed source field' using errcode = '22023'; end if;
    end if;
    new.created_at := old.created_at;
    new.version := old.version + case when old.write_xid = pg_current_xact_id() then 0 else 1 end;
  end if;
  if (array_ndims(new.tags) is not null and array_ndims(new.tags) <> 1)
    or exists (select 1 from unnest(new.tags) tag where tag is null or char_length(btrim(tag)) not between 1 and 50)
    or (select count(distinct tag) from unnest(new.tags) tag) <> cardinality(new.tags)
  then raise exception 'Invalid variant tags' using errcode = '22023'; end if;
  new.updated_at := clock_timestamp();
  new.write_xid := pg_current_xact_id();
  return new;
end $$;

create function distribution_private.check_variant_media() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare variant public.distribution_variants; mime text; parent_id uuid;
begin
  if tg_op = 'UPDATE' and (new.variant_id, new.media_id) is distinct from (old.variant_id, old.media_id) then
    raise exception 'Media relationship identity is immutable' using errcode = '22023';
  end if;
  parent_id := case when tg_op = 'DELETE' then old.variant_id else new.variant_id end;
  select * into variant from public.distribution_variants where id = parent_id for update;
  if not found then
    if tg_op = 'DELETE' and pg_trigger_depth() > 1 then return old; end if;
    raise exception 'Variant is unavailable' using errcode = '23503';
  end if;
  perform distribution_private.lock_variant_source(variant.post_id, variant.account_id, variant.platform);
  if tg_op <> 'DELETE' then
    select lower(coalesce(metadata->>'mimetype', '')) into mime
      from storage.objects where id = new.media_id and bucket_id = 'media' for share;
    if not found then raise exception 'Choose an existing object from the media bucket' using errcode = '23503'; end if;
    if new.is_cover and mime not like 'image/%' then
      raise exception 'The cover must be an existing image' using errcode = '22023';
    end if;
  end if;
  if variant.write_xid <> pg_current_xact_id() then
    update public.distribution_variants set version = version where id = parent_id;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  if tg_op = 'UPDATE' then new.created_at := old.created_at; else new.created_at := clock_timestamp(); end if;
  return new;
end $$;

create function distribution_private.copy_variant_source_media() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.distribution_variant_media(variant_id, media_id, sort_order)
    select new.id, item::uuid, ordinality - 1
    from jsonb_array_elements_text(new.source_snapshot->'media_ids') with ordinality as source(item, ordinality);
  return null;
end $$;

-- Check the committed aggregate, so direct relationship changes and RPC saves
-- must satisfy the same readiness rule even when media is replaced in one transaction.
create function distribution_private.check_variant_readiness() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare variant public.distribution_variants; parent_id uuid; images integer; videos integer;
begin
  if tg_table_name = 'distribution_variants' then
    parent_id := new.id;
  elsif tg_op = 'DELETE' then
    parent_id := old.variant_id;
  else
    parent_id := new.variant_id;
  end if;
  select * into variant from public.distribution_variants where id = parent_id;
  if not found or variant.status <> 'ready' then return null; end if;
  select count(*) filter (where lower(o.metadata->>'mimetype') like 'image/%'),
    count(*) filter (where lower(o.metadata->>'mimetype') like 'video/%')
    into images, videos
    from public.distribution_variant_media m
    join storage.objects o on o.id = m.media_id and o.bucket_id = 'media'
    where m.variant_id = parent_id;
  if variant.title !~ '[^[:space:]]'
    or (variant.content_type = 'article' and variant.body !~ '[^[:space:]]')
    or (variant.content_type = 'moment' and variant.body !~ '[^[:space:]]' and images + videos = 0)
    or (variant.content_type = 'image_text' and images = 0)
    or (variant.content_type = 'video' and videos = 0)
  then raise exception 'Ready variant is missing required text or media' using errcode = '22023'; end if;
  if variant.platform = 'youtube' and variant.content_type = 'video'
    and (char_length(variant.title) > 100 or char_length(variant.body) > 5000)
  then raise exception 'YouTube Studio video text limit exceeded' using errcode = '22023'; end if;
  return null;
end $$;

create trigger distribution_variant_touch before insert or update on public.distribution_variants
  for each row execute function distribution_private.touch_variant();
create trigger distribution_variant_copy_media after insert on public.distribution_variants
  for each row execute function distribution_private.copy_variant_source_media();
create trigger distribution_variant_media_check before insert or update or delete on public.distribution_variant_media
  for each row execute function distribution_private.check_variant_media();
create constraint trigger distribution_variant_ready after insert or update on public.distribution_variants
  deferrable initially deferred for each row execute function distribution_private.check_variant_readiness();
create constraint trigger distribution_variant_media_ready after insert or update or delete on public.distribution_variant_media
  deferrable initially deferred for each row execute function distribution_private.check_variant_readiness();

create function distribution_private.variant_with_media(p_id uuid) returns jsonb
language sql security invoker set search_path = '' as $$
  select (to_jsonb(v) - 'write_xid') || jsonb_build_object('media', coalesce((
    select jsonb_agg(jsonb_build_object('media_id', m.media_id, 'is_cover', m.is_cover,
      'aspect_ratio_hint', m.aspect_ratio_hint, 'processing_notes', m.processing_notes) order by m.sort_order)
    from public.distribution_variant_media m where m.variant_id = p_id
  ), '[]'::jsonb)) from public.distribution_variants v where v.id = p_id;
$$;

create function distribution_private.lock_variant_revision(p_id uuid, p_version integer)
returns public.distribution_variants language plpgsql security invoker set search_path = '' as $$
declare variant public.distribution_variants;
begin
  if p_id is null or p_version is null or p_version < 1 then
    raise exception 'Invalid variant revision' using errcode = '22023';
  end if;
  select * into variant from public.distribution_variants where id = p_id;
  if not found then raise exception 'Variant changed or is unavailable' using errcode = 'PT409'; end if;
  perform distribution_private.lock_variant_source(variant.post_id, variant.account_id, variant.platform);
  select * into variant from public.distribution_variants where id = p_id for update;
  if not found or variant.version <> p_version then
    raise exception 'Variant changed; reload before saving' using errcode = 'PT409';
  end if;
  return variant;
end $$;

create function distribution_private.replace_variant_media(p_id uuid, p_media jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if jsonb_typeof(p_media) is distinct from 'array' or octet_length(p_media::text) > 120000 then
    raise exception 'Invalid variant media payload' using errcode = '22023';
  end if;
  if jsonb_array_length(p_media) > 20 or exists (
    select 1 from jsonb_array_elements(p_media) m
    where jsonb_typeof(m) <> 'object'
       or not m ?& array['media_id','is_cover','aspect_ratio_hint','processing_notes']
       or m - array['media_id','is_cover','aspect_ratio_hint','processing_notes'] <> '{}'::jsonb
       or jsonb_typeof(m->'media_id') <> 'string' or jsonb_typeof(m->'is_cover') <> 'boolean'
       or jsonb_typeof(m->'aspect_ratio_hint') <> 'string' or jsonb_typeof(m->'processing_notes') <> 'string'
  ) then raise exception 'Invalid variant media entries' using errcode = '22023'; end if;
  if (select count(distinct (m->>'media_id')::uuid) from jsonb_array_elements(p_media) m) <> jsonb_array_length(p_media)
    or (select count(*) from jsonb_array_elements(p_media) m where (m->>'is_cover')::boolean) > 1
  then raise exception 'Media IDs must be unique and at most one may be the cover' using errcode = '22023'; end if;
  delete from public.distribution_variant_media where variant_id = p_id;
  insert into public.distribution_variant_media(variant_id, media_id, sort_order, is_cover, aspect_ratio_hint, processing_notes)
    select p_id, (item->>'media_id')::uuid, ordinality - 1, (item->>'is_cover')::boolean,
      item->>'aspect_ratio_hint', item->>'processing_notes'
    from jsonb_array_elements(p_media) with ordinality as m(item, ordinality);
end $$;

create function public.create_distribution_variant(p_id uuid, p_post_id uuid, p_account_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare variant_id uuid;
begin
  perform distribution_private.assert_variant_admin();
  if p_id is null or p_post_id is null or p_account_id is null then
    raise exception 'Invalid variant identifiers' using errcode = '22023';
  end if;
  if exists (select 1 from public.distribution_variants where id = p_id and (post_id, account_id) <> (p_post_id, p_account_id)) then
    raise exception 'Variant identifier already in use' using errcode = 'PT409';
  end if;
  select id into variant_id from public.distribution_variants where post_id = p_post_id and account_id = p_account_id;
  if not found then
    begin
      insert into public.distribution_variants(id, post_id, account_id)
        values (p_id, p_post_id, p_account_id)
        on conflict (post_id, account_id) do nothing returning id into variant_id;
    exception when unique_violation then
      raise exception 'Variant identifier already in use' using errcode = 'PT409';
    end;
    if variant_id is null then
      select id into variant_id from public.distribution_variants where post_id = p_post_id and account_id = p_account_id;
    end if;
  end if;
  if variant_id is null then raise exception 'Variant changed; reload the target list' using errcode = 'PT409'; end if;
  return distribution_private.variant_with_media(variant_id);
end $$;

create function public.save_distribution_variant(p_id uuid, p_version integer, p_variant jsonb, p_media jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare input public.distribution_variants;
begin
  perform distribution_private.assert_variant_admin();
  if jsonb_typeof(p_variant) is distinct from 'object' or octet_length(p_variant::text) > 524288
    or not p_variant ?& array['title','body','tags','content_type','status']
    or p_variant - array['title','body','tags','content_type','status'] <> '{}'::jsonb
    or jsonb_typeof(p_variant->'tags') <> 'array'
    or exists (select 1 from jsonb_each(p_variant) f where f.key <> 'tags' and jsonb_typeof(f.value) <> 'string')
  then raise exception 'Invalid variant payload' using errcode = '22023'; end if;
  if exists (select 1 from jsonb_array_elements(p_variant->'tags') tag where jsonb_typeof(tag) <> 'string') then
    raise exception 'Invalid variant tags' using errcode = '22023';
  end if;
  perform distribution_private.lock_variant_revision(p_id, p_version);
  input := jsonb_populate_record(null::public.distribution_variants, p_variant);
  update public.distribution_variants set title = input.title, body = input.body, tags = input.tags,
    content_type = input.content_type, status = input.status where id = p_id;
  perform distribution_private.replace_variant_media(p_id, p_media);
  return distribution_private.variant_with_media(p_id);
end $$;

create function public.sync_distribution_variant(p_id uuid, p_version integer, p_source_version integer, p_fields text[])
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare variant public.distribution_variants; source public.distribution_posts; snapshot jsonb; media jsonb;
begin
  perform distribution_private.assert_variant_admin();
  if p_fields is null or cardinality(p_fields) not between 1 and 5 or array_ndims(p_fields) <> 1
    or (select count(distinct field) from unnest(p_fields) field) <> cardinality(p_fields)
    or exists (select 1 from unnest(p_fields) field where field not in ('title','body','tags','content_type','media_ids'))
  then raise exception 'Select changed source fields to sync' using errcode = '22023'; end if;
  variant := distribution_private.lock_variant_revision(p_id, p_version);
  source := distribution_private.lock_variant_source(variant.post_id, variant.account_id, variant.platform);
  if source.version is distinct from p_source_version or source.version <= variant.source_version then
    raise exception 'Source changed; reload before syncing' using errcode = 'PT409';
  end if;
  snapshot := distribution_private.variant_source_snapshot(source);
  if exists (select 1 from unnest(p_fields) field where snapshot->field is not distinct from variant.source_snapshot->field)
  then raise exception 'Selected fields must have changed at the source' using errcode = '22023'; end if;
  if 'media_ids' = any(p_fields) then
    select coalesce(jsonb_agg(jsonb_build_object('media_id', s.id, 'is_cover', coalesce(m.is_cover, false),
      'aspect_ratio_hint', coalesce(m.aspect_ratio_hint, ''), 'processing_notes', coalesce(m.processing_notes, ''))
      order by s.ordinality), '[]'::jsonb) into media
      from jsonb_array_elements_text(snapshot->'media_ids') with ordinality as s(id, ordinality)
      left join public.distribution_variant_media m on m.variant_id = p_id and m.media_id = s.id::uuid;
    perform distribution_private.replace_variant_media(p_id, media);
  end if;
  update public.distribution_variants set
    title = case when 'title' = any(p_fields) then source.title else variant.title end,
    body = case when 'body' = any(p_fields) then source.body else variant.body end,
    tags = case when 'tags' = any(p_fields) then source.tags else variant.tags end,
    content_type = case when 'content_type' = any(p_fields) then source.content_type else variant.content_type end,
    status = 'draft', source_version = source.version, source_snapshot = snapshot
    where id = p_id;
  return distribution_private.variant_with_media(p_id);
end $$;

-- Trigger functions are not callable by API roles. Invoker helpers are usable
-- only with the caller's existing table privileges and RLS.
revoke all on function distribution_private.touch_variant(), distribution_private.check_variant_media(),
  distribution_private.copy_variant_source_media(), distribution_private.check_variant_readiness()
  from public, anon, authenticated;
revoke all on function distribution_private.assert_variant_admin(), distribution_private.lock_variant_source(uuid,uuid,text),
  distribution_private.variant_source_snapshot(public.distribution_posts), distribution_private.variant_with_media(uuid),
  distribution_private.lock_variant_revision(uuid,integer), distribution_private.replace_variant_media(uuid,jsonb)
  from public, anon, authenticated;
grant execute on function distribution_private.assert_variant_admin(), distribution_private.lock_variant_source(uuid,uuid,text),
  distribution_private.variant_source_snapshot(public.distribution_posts), distribution_private.variant_with_media(uuid),
  distribution_private.lock_variant_revision(uuid,integer), distribution_private.replace_variant_media(uuid,jsonb)
  to authenticated;
revoke all on function public.create_distribution_variant(uuid,uuid,uuid), public.save_distribution_variant(uuid,integer,jsonb,jsonb),
  public.sync_distribution_variant(uuid,integer,integer,text[]) from public, anon, authenticated;
grant execute on function public.create_distribution_variant(uuid,uuid,uuid), public.save_distribution_variant(uuid,integer,jsonb,jsonb),
  public.sync_distribution_variant(uuid,integer,integer,text[]) to authenticated;

comment on table public.distribution_variants is 'Private account-specific preparation snapshots. ready indicates local preparation only.';
comment on column public.distribution_variants.source_snapshot is 'Source content observed at the last explicit sync. Variant content remains independent.';
comment on table public.distribution_variant_media is 'Existing Storage objects with order and optional processing intentions. No binary transformations.';
commit;
