-- M3: manual publishing calendar, frozen content and append-only audit.
begin;

create schema distribution_publish_private;
revoke all on schema distribution_publish_private from public, anon, authenticated, service_role;
create role distribution_publish_writer nologin nobypassrls;
-- Reuse the caller's existing M1/M2 policies and authenticated claims.
grant authenticated to distribution_publish_writer with inherit true, set false;
grant distribution_publish_writer to current_user with set true;
grant usage, create on schema distribution_publish_private to distribution_publish_writer;

create table public.distribution_publish_tasks (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.distribution_variants(id) on delete restrict,
  post_id uuid not null references public.distribution_posts(id) on delete restrict,
  account_id uuid not null references public.distribution_accounts(id) on delete restrict,
  platform text not null check (platform in ('xiaohongshu','douyin','bilibili','wechat','weibo','zhihu','x','youtube','other')),
  variant_version integer not null check (variant_version > 0),
  content_snapshot jsonb not null,
  title text generated always as (content_snapshot->>'title') stored not null,
  account_name text generated always as (content_snapshot->>'account_name') stored not null,
  scheduled_at timestamptz not null check (isfinite(scheduled_at)),
  timezone text not null check (char_length(timezone) between 1 and 100),
  plan_note text not null check (char_length(plan_note) <= 2000),
  status text not null check (status in ('planned','awaiting_confirmation','manually_reported','cancelled')),
  version integer not null check (version > 0),
  published_at timestamptz,
  reported_at timestamptz,
  reported_by uuid,
  external_url text check (char_length(external_url) <= 2048),
  report_note text check (char_length(report_note) between 1 and 2000),
  report_evidence text,
  created_by uuid not null,
  updated_by uuid not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  constraint distribution_publish_snapshot_identity check (
    jsonb_typeof(content_snapshot) = 'object'
    and content_snapshot ?& array['variant_id','variant_version','post_id','account_id','platform','media','captured_at']
    and content_snapshot->'variant_id' = to_jsonb(variant_id)
    and content_snapshot->'variant_version' = to_jsonb(variant_version)
    and content_snapshot->'post_id' = to_jsonb(post_id)
    and content_snapshot->'account_id' = to_jsonb(account_id)
    and content_snapshot->'platform' = to_jsonb(platform)
    and jsonb_typeof(content_snapshot->'media') = 'array'
  ),
  constraint distribution_publish_manual_evidence check (
    case when status = 'manually_reported' then
      published_at is not null and isfinite(published_at)
      and reported_at is not null and isfinite(reported_at) and reported_by is not null
      and report_evidence is not distinct from 'manual_user_report'
      and (external_url is not null or report_note is not null)
    else published_at is null and reported_at is null and reported_by is null
      and report_evidence is null and external_url is null and report_note is null
    end
  )
);
create index distribution_publish_tasks_schedule_idx on public.distribution_publish_tasks(scheduled_at, id);
create index distribution_publish_tasks_account_idx on public.distribution_publish_tasks(account_id, scheduled_at, id);
create index distribution_publish_tasks_platform_idx on public.distribution_publish_tasks(platform, scheduled_at, id);
create index distribution_publish_tasks_status_idx on public.distribution_publish_tasks(status, scheduled_at, id);
create index distribution_publish_tasks_post_idx on public.distribution_publish_tasks(post_id);
create index distribution_publish_tasks_variant_idx on public.distribution_publish_tasks(variant_id);

-- Protect the union of media in current and superseded audited snapshots.
create table public.distribution_publish_task_media (
  task_id uuid not null references public.distribution_publish_tasks(id) on delete restrict,
  media_id uuid not null references storage.objects(id) on delete restrict,
  primary key (task_id, media_id)
);
create index distribution_publish_task_media_object_idx on public.distribution_publish_task_media(media_id);

create table public.distribution_publish_logs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.distribution_publish_tasks(id) on delete restrict,
  task_version integer not null check (task_version > 0),
  event_type text not null check (event_type in (
    'task_created','task_rescheduled','task_snapshot_updated','task_started',
    'manual_reported','manual_report_corrected','task_returned','task_cancelled'
  )),
  actor_id uuid not null,
  request_id uuid not null constraint distribution_publish_logs_request_id_key unique,
  request_fingerprint bytea not null check (octet_length(request_fingerprint) = 32),
  old_state jsonb,
  new_state jsonb not null check (jsonb_typeof(new_state) = 'object'),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null,
  unique (task_id, task_version)
);

do $$
declare target regclass;
begin
  foreach target in array array[
    'public.distribution_publish_tasks'::regclass,
    'public.distribution_publish_task_media'::regclass,
    'public.distribution_publish_logs'::regclass
  ] loop
    execute format('alter table %s enable row level security', target);
    execute format('alter table %s force row level security', target);
    execute format('revoke all on %s from public, anon, authenticated, service_role', target);
    execute format('grant select on %s to authenticated', target);
    execute format('create policy "Distribution publish admin" on %s for select to authenticated
      using (exists (select 1 from public.admin_users where user_id = (select auth.uid())))', target);
    execute format('create policy "Distribution publish MFA" on %s as restrictive for all to authenticated
      using ((select auth.jwt()->>''aal'') = ''aal2'' and exists
        (select 1 from public.admin_users where user_id = (select auth.uid())))
      with check ((select auth.jwt()->>''aal'') = ''aal2'' and exists
        (select 1 from public.admin_users where user_id = (select auth.uid())))', target);
  end loop;
end $$;

grant insert on public.distribution_publish_tasks, public.distribution_publish_task_media,
  public.distribution_publish_logs to distribution_publish_writer;
grant update (scheduled_at, timezone, plan_note, variant_version, content_snapshot,
  status, version, published_at, reported_at, reported_by, external_url, report_note,
  report_evidence, updated_by, updated_at) on public.distribution_publish_tasks to distribution_publish_writer;

-- The inherited restrictive policy still applies to all writer operations.
create policy "Distribution publish writer insert" on public.distribution_publish_tasks
  for insert to distribution_publish_writer with check (created_by = (select auth.uid()) and updated_by = (select auth.uid()));
create policy "Distribution publish writer update" on public.distribution_publish_tasks
  for update to distribution_publish_writer using (true) with check (updated_by = (select auth.uid()));
create policy "Distribution publish writer media" on public.distribution_publish_task_media
  for insert to distribution_publish_writer with check (true);
create policy "Distribution publish writer audit" on public.distribution_publish_logs
  for insert to distribution_publish_writer with check (actor_id = (select auth.uid()));

create function distribution_publish_private.check_payload(payload jsonb, strings text[], integers text[])
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not payload ?& (strings || integers) or payload - (strings || integers) <> '{}'::jsonb
    or exists (select 1 from unnest(strings) k where jsonb_typeof(payload->k) <> 'string')
    or exists (select 1 from unnest(integers) k
      where jsonb_typeof(payload->k) <> 'number' or payload->>k !~ '^[1-9][0-9]{0,9}$')
  then raise exception 'Invalid publishing task fields' using errcode = '22023'; end if;
end $$;

create function distribution_publish_private.parse_instant(value text)
returns timestamptz language plpgsql security invoker set search_path = '' as $$
begin
  if value is null or value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$'
  then raise exception 'An ISO timestamp with explicit offset is required' using errcode = '22023'; end if;
  return value::timestamptz;
end $$;

create function distribution_publish_private.check_work_url(value text)
returns void language plpgsql security invoker set search_path = '' as $$
declare authority text[]; host_name text; label text; address inet;
begin
  if value is null then return; end if;
  authority := regexp_match(value, '^https?://(\[[0-9a-fA-F:.]+\]|[a-zA-Z0-9.-]+)(:([0-9]{1,5}))?([/?#]|$)', 'i');
  if char_length(value) > 2048 or authority is null or value ~ '[^!-~]'
    or value ~ '[<>"{}|^]' or strpos(value, chr(92)) > 0 or strpos(value, chr(96)) > 0
    or regexp_replace(value, '^https?://\[[0-9a-fA-F:.]+\]', '', 'i') ~ '[\[\]]'
    or strpos(regexp_replace(value, '%[0-9a-fA-F]{2}', '', 'g'), '%') > 0
    or authority[3]::integer > 65535
  then raise exception 'Invalid HTTP(S) work URL' using errcode = '22023'; end if;
  host_name := authority[1];
  if left(host_name, 1) = '[' then
    address := substring(host_name from 2 for char_length(host_name) - 2)::inet;
    if family(address) = 6 then return; end if;
  else
    foreach label in array string_to_array(rtrim(host_name, '.'), '.') loop
      if label !~ '^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$'
      then raise exception 'Invalid HTTP(S) work URL host' using errcode = '22023'; end if;
    end loop;
    if char_length(host_name) between 1 and 253 and host_name ~ '[a-zA-Z0-9]' and host_name !~ '\.\.$' then
      if rtrim(host_name, '.') ~ '(^|\.)[0-9]+$' then
        if host_name ~ '^[0-9]{1,3}(\.[0-9]{1,3}){3}$' then
          address := host_name::inet;
          if family(address) = 4 then return; end if;
        end if;
      else
        return;
      end if;
    end if;
  end if;
  raise exception 'Invalid HTTP(S) work URL host' using errcode = '22023';
exception when invalid_text_representation then
  raise exception 'Invalid HTTP(S) work URL host' using errcode = '22023';
end $$;

create function distribution_publish_private.capture_snapshot(variant_id uuid, expected_version integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  variant public.distribution_variants;
  account public.distribution_accounts;
  assets jsonb;
  images integer;
  videos integer;
begin
  select * into variant from public.distribution_variants where id = variant_id;
  if not found then raise exception 'Platform draft is unavailable' using errcode = 'PT409'; end if;
  -- Follow the M2 save order: source, account and target before the variant.
  perform distribution_private.lock_variant_source(variant.post_id, variant.account_id, variant.platform);
  select * into variant from public.distribution_variants where id = variant_id for share;
  if not found or variant.version is distinct from expected_version then
    raise exception 'Platform draft changed; reload the draft' using errcode = 'PT409';
  end if;
  if variant.status <> 'ready' then
    raise exception 'Only a ready platform draft may be scheduled' using errcode = '22023';
  end if;
  select * into strict account from public.distribution_accounts where id = variant.account_id;
  select coalesce(jsonb_agg(asset order by (asset->>'sort_order')::integer), '[]'::jsonb),
    count(*) filter (where asset->>'mime_type' like 'image/%'),
    count(*) filter (where asset->>'mime_type' like 'video/%')
    into assets, images, videos
    from (
      select jsonb_build_object(
        'media_id', m.media_id, 'sort_order', m.sort_order, 'is_cover', m.is_cover,
        'aspect_ratio_hint', m.aspect_ratio_hint, 'processing_notes', m.processing_notes,
        'original_storage_path', o.name, 'mime_type', lower(coalesce(o.metadata->>'mimetype', ''))
      ) asset
      from public.distribution_variant_media m
      join storage.objects o on o.id = m.media_id and o.bucket_id = 'media'
      where m.variant_id = variant.id order by o.id for share of o
    ) objects;
  if jsonb_array_length(assets) <> (select count(*) from public.distribution_variant_media m where m.variant_id = variant.id)
    or exists (select 1 from jsonb_array_elements(assets) a
      where (a->>'is_cover')::boolean and a->>'mime_type' not like 'image/%')
    or (variant.content_type = 'image_text' and images = 0)
    or (variant.content_type = 'video' and videos = 0)
    or (variant.content_type = 'moment' and variant.body !~ '[^[:space:]]' and images + videos = 0)
  then raise exception 'The ready platform draft has unavailable or invalid media' using errcode = '22023'; end if;
  return jsonb_build_object(
    'variant_id', variant.id, 'variant_version', variant.version, 'post_id', variant.post_id,
    'account_id', account.id, 'account_name', account.name, 'profile_url', account.profile_url,
    'platform', variant.platform, 'source_version', variant.source_version,
    'title', variant.title, 'body', variant.body, 'tags', variant.tags, 'content_type', variant.content_type,
    'media', assets, 'captured_at', clock_timestamp()
  );
end $$;

-- The sole application writer. Inputs describe commands. State, actor,
-- snapshot and event type are derived inside the transaction.
create function distribution_publish_private.change_task(
  request_id uuid, action text, task_id uuid, expected_version integer, payload jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid;
  fingerprint bytea;
  prior public.distribution_publish_logs;
  task public.distribution_publish_tasks;
  before_state jsonb;
  after_state jsonb;
  event_type text;
  changed_at timestamptz;
  schedule timestamptz;
  reason text;
  open_task boolean;
begin
  -- Claims refer to the original caller. Verify them before any read, lock,
  -- write or replay.
  perform distribution_private.assert_variant_admin();
  actor := auth.uid();
  if request_id is null or action is null or jsonb_typeof(payload) is distinct from 'object'
    or octet_length(payload::text) > 16000
  then raise exception 'Invalid publishing request' using errcode = '22023'; end if;
  fingerprint := sha256(convert_to(jsonb_build_array(action, task_id, expected_version, payload)::text, 'UTF8'));
  perform pg_advisory_xact_lock(hashtextextended('distribution_publish_request:' || request_id::text, 0));
  select * into prior from public.distribution_publish_logs l where l.request_id = change_task.request_id;
  if found then
    if prior.actor_id is distinct from actor or prior.request_fingerprint is distinct from fingerprint then
      raise exception 'Request ID has already been used' using errcode = 'PT409';
    end if;
    return prior.new_state;
  end if;

  if action = 'create' then
    if task_id is not null or expected_version is not null then
      raise exception 'New tasks must not include a task ID or version' using errcode = '22023';
    end if;
    perform distribution_publish_private.check_payload(payload,
      array['variant_id','scheduled_at','timezone','plan_note'], array['variant_version']);
    task.content_snapshot := distribution_publish_private.capture_snapshot(
      (payload->>'variant_id')::uuid, (payload->>'variant_version')::integer);
    task.id := gen_random_uuid();
    task.variant_id := (task.content_snapshot->>'variant_id')::uuid;
    task.post_id := (task.content_snapshot->>'post_id')::uuid;
    task.account_id := (task.content_snapshot->>'account_id')::uuid;
    task.platform := task.content_snapshot->>'platform';
    task.variant_version := (task.content_snapshot->>'variant_version')::integer;
    task.status := 'planned';
    task.version := 1;
    task.created_by := actor;
    event_type := 'task_created';
  else
    if task_id is null or expected_version is null or expected_version < 1 then
      raise exception 'Task ID and version are required' using errcode = '22023';
    end if;
    select * into task from public.distribution_publish_tasks t where t.id = change_task.task_id for update;
    if not found or task.version <> expected_version then
      raise exception 'Publishing task changed; reload before saving' using errcode = 'PT409';
    end if;
    before_state := to_jsonb(task);
    open_task := task.status in ('planned', 'awaiting_confirmation');
    task.version := task.version + 1;

    case action
      when 'reschedule' then
        if open_task then event_type := 'task_rescheduled'; end if;
      when 'refresh_snapshot' then
        if open_task then event_type := 'task_snapshot_updated'; end if;
        perform distribution_publish_private.check_payload(payload, array[]::text[], array['variant_version']);
      when 'start' then
        if task.status = 'planned' then
          event_type := 'task_started';
          task.status := 'awaiting_confirmation';
        end if;
        perform distribution_publish_private.check_payload(payload, array[]::text[], array[]::text[]);
      when 'return' then
        if task.status = 'awaiting_confirmation' then
          event_type := 'task_returned';
          task.status := 'planned';
        end if;
        perform distribution_publish_private.check_payload(payload, array['reason'], array[]::text[]);
      when 'cancel' then
        if open_task then
          event_type := 'task_cancelled';
          task.status := 'cancelled';
        end if;
        perform distribution_publish_private.check_payload(payload, array['reason'], array[]::text[]);
      when 'report' then
        if task.status = 'awaiting_confirmation' then
          event_type := 'manual_reported';
          task.status := 'manually_reported';
        end if;
      when 'correct_report' then
        if task.status = 'manually_reported' then event_type := 'manual_report_corrected'; end if;
      else raise exception 'Unknown publishing action' using errcode = '22023';
    end case;
    if event_type is null then
      raise exception 'Task status does not allow this action' using errcode = '22023';
    end if;
  end if;

  if action in ('create', 'reschedule') then
    if action = 'reschedule' then
      perform distribution_publish_private.check_payload(payload, array['scheduled_at','timezone','plan_note'], array[]::text[]);
    end if;
    schedule := distribution_publish_private.parse_instant(payload->>'scheduled_at');
    if schedule is distinct from task.scheduled_at and schedule <= clock_timestamp() then
      raise exception 'A new schedule must be in the future' using errcode = '22023';
    end if;
    if (payload->>'timezone') !~ '^(UTC|[A-Za-z_]+/[A-Za-z0-9_+/-]+)$'
      or not exists (select 1 from pg_timezone_names where name = payload->>'timezone')
    then raise exception 'Choose a valid IANA time zone' using errcode = '22023'; end if;
    if (schedule, payload->>'timezone', payload->>'plan_note') is not distinct from
      (task.scheduled_at, task.timezone, task.plan_note)
    then raise exception 'The schedule has not changed' using errcode = '22023'; end if;
    if char_length(payload->>'plan_note') > 2000 then
      raise exception 'Plan note is too long' using errcode = '22023';
    end if;
    task.scheduled_at := schedule;
    task.timezone := payload->>'timezone';
    task.plan_note := payload->>'plan_note';
  elsif action = 'refresh_snapshot' then
    if (payload->>'variant_version')::integer <= task.variant_version then
      raise exception 'Choose a newer platform draft version' using errcode = 'PT409';
    end if;
    task.content_snapshot := distribution_publish_private.capture_snapshot(task.variant_id, (payload->>'variant_version')::integer);
    task.variant_version := (task.content_snapshot->>'variant_version')::integer;
  elsif action in ('report', 'correct_report') then
    perform distribution_publish_private.check_payload(payload, array['published_at','external_url','report_note','account_id']
      || case when action = 'correct_report' then array['reason'] else array[]::text[] end, array['variant_version']);
    if (payload->>'account_id')::uuid is distinct from task.account_id
      or (payload->>'variant_version')::integer is distinct from task.variant_version
    then raise exception 'The account or snapshot changed; confirm the recorded values' using errcode = 'PT409'; end if;
    task.published_at := distribution_publish_private.parse_instant(payload->>'published_at');
    if task.published_at > clock_timestamp() then
      raise exception 'Actual publish time must not be in the future' using errcode = '22023';
    end if;
    task.external_url := nullif(btrim(payload->>'external_url'), '');
    perform distribution_publish_private.check_work_url(task.external_url);
    task.report_note := nullif(btrim(payload->>'report_note', E' \n\r\t'), '');
    if task.external_url is null and task.report_note is null then
      raise exception 'A work URL or confirmation note is required' using errcode = '22023';
    end if;
    if action = 'report' then
      task.reported_at := clock_timestamp();
      task.reported_by := actor;
      task.report_evidence := 'manual_user_report';
    end if;
  end if;
  if action in ('return','cancel','correct_report') then
    reason := btrim(payload->>'reason', E' \n\r\t');
    if char_length(reason) not between 1 and 2000 then
      raise exception 'An audit reason is required' using errcode = '22023';
    end if;
  end if;

  changed_at := clock_timestamp();
  if action = 'create' then
    insert into public.distribution_publish_tasks (
      id, variant_id, post_id, account_id, platform, variant_version, content_snapshot,
      scheduled_at, timezone, plan_note, status, version, created_by, updated_by, created_at, updated_at
    ) values (
      task.id, task.variant_id, task.post_id, task.account_id, task.platform, task.variant_version, task.content_snapshot,
      task.scheduled_at, task.timezone, task.plan_note, task.status, task.version, actor, actor, changed_at, changed_at
    ) returning * into task;
  else
    update public.distribution_publish_tasks set
      scheduled_at = task.scheduled_at, timezone = task.timezone, plan_note = task.plan_note,
      variant_version = task.variant_version, content_snapshot = task.content_snapshot,
      status = task.status, version = task.version, published_at = task.published_at,
      reported_at = task.reported_at, reported_by = task.reported_by, external_url = task.external_url,
      report_note = task.report_note, report_evidence = task.report_evidence, updated_by = actor, updated_at = changed_at
    where id = task.id returning * into task;
  end if;
  if action in ('create', 'refresh_snapshot') then
    insert into public.distribution_publish_task_media(task_id, media_id)
      select task.id, (asset->>'media_id')::uuid from jsonb_array_elements(task.content_snapshot->'media') asset
      on conflict on constraint distribution_publish_task_media_pkey do nothing;
  end if;
  after_state := to_jsonb(task);
  insert into public.distribution_publish_logs(
    task_id, task_version, event_type, actor_id, request_id, request_fingerprint, old_state, new_state, metadata, created_at
  ) values (
    task.id, task.version, event_type, actor, request_id, fingerprint, before_state, after_state,
    jsonb_strip_nulls(jsonb_build_object('reason', reason,
      'evidence', case when action in ('report','correct_report') then task.report_evidence end)), changed_at
  );
  return after_state;
end $$;

-- Bind by OID. The invoker needs EXECUTE on this one routine, while the
-- private schema stays inaccessible by name.
create function public.change_distribution_publish_task(
  p_request_id uuid, p_action text, p_task_id uuid, p_version integer, p_input jsonb
) returns jsonb language sql security invoker set search_path = ''
  return distribution_publish_private.change_task(p_request_id, p_action, p_task_id, p_version, p_input);

alter function distribution_publish_private.change_task(uuid,text,uuid,integer,jsonb) owner to distribution_publish_writer;
revoke create on schema distribution_publish_private from distribution_publish_writer;
revoke all on all functions in schema distribution_publish_private from public, anon, authenticated, service_role;
grant execute on function distribution_publish_private.check_payload(jsonb,text[],text[]),
  distribution_publish_private.parse_instant(text), distribution_publish_private.check_work_url(text),
  distribution_publish_private.capture_snapshot(uuid,integer) to distribution_publish_writer;
grant execute on function distribution_publish_private.change_task(uuid,text,uuid,integer,jsonb) to authenticated;
revoke all on function public.change_distribution_publish_task(uuid,text,uuid,integer,jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.change_distribution_publish_task(uuid,text,uuid,integer,jsonb) to authenticated;

comment on table public.distribution_publish_tasks is 'Private plans and manual reports, with explicitly versioned content snapshots.';
comment on table public.distribution_publish_logs is 'Append-only for application roles. A transition and its audit entry commit together.';
comment on table public.distribution_publish_task_media is 'Retention references for every snapshot accepted by a task.';
comment on function public.change_distribution_publish_task(uuid,text,uuid,integer,jsonb) is
  'Manual task transitions only. Requires an aal2 site administrator and an idempotency UUID.';
commit;
