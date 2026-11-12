-- Apply after add_distribution_platform_variants. Preserve all existing snapshots.
begin;

alter table public.distribution_variants
  add column source_retained_fields jsonb not null default '{}'::jsonb
  check (jsonb_typeof(source_retained_fields) = 'object');

create or replace function distribution_private.touch_variant() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  source public.distribution_posts;
  fields constant text[] := array['title','body','tags','content_type','media_ids'];
  snapshot jsonb;
  retained jsonb;
  previous_content jsonb;
  next_content jsonb;
  expected_value jsonb;
  media_ids jsonb;
  field text;
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
    new.source_retained_fields := '{}'::jsonb;
    new.created_at := clock_timestamp();
    new.version := 1;
  else
    if (new.id, new.post_id, new.account_id, new.platform) is distinct from (old.id, old.post_id, old.account_id, old.platform) then
      raise exception 'Variant identity and platform snapshot are immutable' using errcode = '22023';
    end if;
    source := distribution_private.lock_variant_source(old.post_id, old.account_id, old.platform);
    if (new.source_version, new.source_snapshot, new.source_retained_fields)
      is distinct from (old.source_version, old.source_snapshot, old.source_retained_fields) then
      if source.version <= old.source_version then
        raise exception 'Source changed; reload before reviewing' using errcode = 'PT409';
      end if;
      if jsonb_typeof(new.source_snapshot) is distinct from 'object'
        or not new.source_snapshot ?& fields or new.source_snapshot - fields <> '{}'::jsonb
        or new.status is distinct from old.status
      then raise exception 'Invalid source review' using errcode = '22023'; end if;

      snapshot := distribution_private.variant_source_snapshot(source);
      retained := old.source_retained_fields;
      previous_content := to_jsonb(old);
      next_content := to_jsonb(new);
      foreach field in array fields loop
        expected_value := previous_content->field;
        if new.source_snapshot->field is distinct from old.source_snapshot->field then
          if new.source_snapshot->field is distinct from snapshot->field then
            raise exception 'Source changed; reload before reviewing' using errcode = 'PT409';
          end if;
          if new.source_retained_fields->field = to_jsonb(source.version) then
            retained := retained || jsonb_build_object(field, source.version);
          else
            retained := retained - field;
            expected_value := snapshot->field;
            if field = 'media_ids' then
              select coalesce(jsonb_agg(m.media_id order by m.sort_order), '[]'::jsonb) into media_ids
                from public.distribution_variant_media m where m.variant_id = old.id;
              if media_ids is distinct from expected_value then
                raise exception 'Reviewed media must match the selected source order' using errcode = '22023';
              end if;
            end if;
          end if;
        end if;
        if field <> 'media_ids' and next_content->field is distinct from expected_value then
          raise exception 'Source review must apply only selected changes' using errcode = '22023';
        end if;
      end loop;
      if new.source_retained_fields is distinct from retained then
        raise exception 'Invalid retained source fields' using errcode = '22023';
      end if;
      if new.source_version is distinct from (case when new.source_snapshot = snapshot then source.version else old.source_version end) then
        raise exception 'Source review still has pending fields' using errcode = '22023';
      end if;
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

create function distribution_private.review_variant_source(
  p_id uuid, p_version integer, p_source_version integer, p_fields text[], p_retain boolean
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  variant public.distribution_variants;
  source public.distribution_posts;
  snapshot jsonb;
  reviewed jsonb;
  retained jsonb;
  media jsonb;
  field text;
begin
  perform distribution_private.assert_variant_admin();
  if p_retain is null or p_fields is null or cardinality(p_fields) > 5
    or coalesce(array_ndims(p_fields), 1) <> 1 or (not p_retain and cardinality(p_fields) = 0)
    or (select count(distinct selected) from unnest(p_fields) selected) <> cardinality(p_fields)
    or exists (select 1 from unnest(p_fields) selected where selected not in ('title','body','tags','content_type','media_ids'))
  then raise exception 'Select changed source fields to review' using errcode = '22023'; end if;

  variant := distribution_private.lock_variant_revision(p_id, p_version);
  source := distribution_private.lock_variant_source(variant.post_id, variant.account_id, variant.platform);
  if source.version is distinct from p_source_version or source.version <= variant.source_version then
    raise exception 'Source changed; reload before reviewing' using errcode = 'PT409';
  end if;

  snapshot := distribution_private.variant_source_snapshot(source);
  reviewed := variant.source_snapshot;
  retained := variant.source_retained_fields;
  if cardinality(p_fields) = 0 and snapshot is distinct from reviewed then
    raise exception 'Review remaining source fields before confirming the version' using errcode = '22023';
  end if;
  foreach field in array p_fields loop
    if snapshot->field is not distinct from reviewed->field then
      raise exception 'Selected fields must have changed at the source' using errcode = '22023';
    end if;
    reviewed := jsonb_set(reviewed, array[field], snapshot->field);
    if p_retain then
      retained := retained || jsonb_build_object(field, source.version);
    else
      retained := retained - field;
    end if;
  end loop;

  if not p_retain and 'media_ids' = any(p_fields) then
    select coalesce(jsonb_agg(jsonb_build_object('media_id', s.id, 'is_cover', coalesce(m.is_cover, false),
      'aspect_ratio_hint', coalesce(m.aspect_ratio_hint, ''), 'processing_notes', coalesce(m.processing_notes, ''))
      order by s.ordinality), '[]'::jsonb) into media
      from jsonb_array_elements_text(snapshot->'media_ids') with ordinality as s(id, ordinality)
      left join public.distribution_variant_media m on m.variant_id = p_id and m.media_id = s.id::uuid;
    perform distribution_private.replace_variant_media(p_id, media);
  end if;

  update public.distribution_variants set
    title = case when not p_retain and 'title' = any(p_fields) then source.title else variant.title end,
    body = case when not p_retain and 'body' = any(p_fields) then source.body else variant.body end,
    tags = case when not p_retain and 'tags' = any(p_fields) then source.tags else variant.tags end,
    content_type = case when not p_retain and 'content_type' = any(p_fields) then source.content_type else variant.content_type end,
    source_version = case when reviewed = snapshot then source.version else variant.source_version end,
    source_snapshot = reviewed, source_retained_fields = retained
  where id = p_id;
  return distribution_private.variant_with_media(p_id);
end $$;

create or replace function public.sync_distribution_variant(p_id uuid, p_version integer, p_source_version integer, p_fields text[])
returns jsonb language sql security invoker set search_path = '' as $$
  select distribution_private.review_variant_source(p_id, p_version, p_source_version, p_fields, false);
$$;

-- An empty array acknowledges a version only when there are no pending content differences.
create function public.retain_distribution_variant_source(p_id uuid, p_version integer, p_source_version integer, p_fields text[])
returns jsonb language sql security invoker set search_path = '' as $$
  select distribution_private.review_variant_source(p_id, p_version, p_source_version, p_fields, true);
$$;

revoke all on function distribution_private.touch_variant() from public, anon, authenticated;
revoke all on function distribution_private.review_variant_source(uuid,integer,integer,text[],boolean),
  public.sync_distribution_variant(uuid,integer,integer,text[]),
  public.retain_distribution_variant_source(uuid,integer,integer,text[]) from public, anon, authenticated;
grant execute on function distribution_private.review_variant_source(uuid,integer,integer,text[],boolean),
  public.sync_distribution_variant(uuid,integer,integer,text[]),
  public.retain_distribution_variant_source(uuid,integer,integer,text[]) to authenticated;

comment on column public.distribution_variants.source_version is 'Last fully reviewed content source revision.';
comment on column public.distribution_variants.source_snapshot is 'Per-field source baseline. Only adopted or explicitly retained fields advance.';
comment on column public.distribution_variants.source_retained_fields is 'Explicit keep decisions by field and source revision.';
commit;
