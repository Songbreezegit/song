-- Freeze the byte version and serving path of media retained by M3 history.
begin;
set local lock_timeout = '5s';
set local row_security = off;

-- Keep concurrent Storage writes out until the existing paths are checked
-- and the trigger is visible. Reads can continue.
lock table storage.objects in share row exclusive mode;
do $review$
begin
  if not exists (select 1 from pg_roles where rolname = current_user and (rolbypassrls or rolsuper)) then
    raise exception 'Distribution publish media guard requires the database maintenance role';
  end if;
  if exists (
    select 1 from storage.buckets b where b.id = 'media'
      and coalesce(to_jsonb(b)->>'versioning_status', 'DISABLED') <> 'DISABLED'
  ) then
    raise exception 'Review bucket versioning before installing distribution publish media protection';
  end if;
  if exists (
    select 1
    from public.distribution_publish_logs l
    cross join lateral jsonb_array_elements(l.new_state->'content_snapshot'->'media') as assets(asset)
    left join storage.objects o on o.id = (asset->>'media_id')::uuid
    where l.event_type in ('task_created','task_snapshot_updated')
      and (o.bucket_id is distinct from 'media' or o.name is distinct from asset->>'original_storage_path'
        or to_jsonb(o)->>'archived_at' is not null or to_jsonb(o)->>'is_delete_marker' = 'true'
        or not exists (select 1 from public.distribution_publish_task_media m where m.task_id = l.task_id and m.media_id = o.id))
  ) then
    raise exception 'Existing distribution publish media paths require review';
  end if;
end $review$;

create function distribution_publish_private.protect_task_media()
returns trigger language plpgsql volatile security definer
set search_path = '' set row_security = off as $$
begin
  -- Storage uploads use a new backend version. A move changes the path.
  -- Archiving or marking the row deleted also changes what the old URL serves.
  -- to_jsonb covers the optional versioning fields on newer Storage schemas.
  if (old.id, old.bucket_id, old.name, old.version, old.metadata) is distinct from
       (new.id, new.bucket_id, new.name, new.version, new.metadata)
    or to_jsonb(old)->'archived_at' is distinct from to_jsonb(new)->'archived_at'
    or to_jsonb(old)->'is_delete_marker' is distinct from to_jsonb(new)->'is_delete_marker'
    or to_jsonb(old)->'is_versioned' is distinct from to_jsonb(new)->'is_versioned'
  then
    -- capture_snapshot holds FOR SHARE on this object until it records the link.
    -- The volatile lookup sees the committed link after an UPDATE waits on it.
    if exists (select 1 from public.distribution_publish_task_media m where m.media_id = old.id)
    then raise exception 'Media is retained by a distribution publish task' using errcode = '42501'; end if;
  end if;
  return null;
end $$;

-- Trigger-only. The owner can see historical links even for Storage's internal
-- writes. No role gains a callable routine or permission on the history tables.
revoke all on function distribution_publish_private.protect_task_media()
  from public, anon, authenticated, service_role, distribution_publish_writer;
create trigger distribution_protect_task_media
after update on storage.objects
for each row execute function distribution_publish_private.protect_task_media();

commit;
