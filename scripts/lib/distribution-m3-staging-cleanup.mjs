import { check, isStagingResourceUuid, ProbeError } from './distribution-staging-target.mjs';

const project = 'uartrtcmskyuqxawjqlx';

function uuid(value) {
  if (!isStagingResourceUuid(value)) throw new Error('Invalid run resource UUID');
  return "'" + value.toLowerCase() + "'::uuid";
}

function scopeSql({ project_ref, run_id, actor_ids, source, account, variant, request_ids, media_ids }) {
  if (project_ref !== project || !Array.isArray(actor_ids) || actor_ids.length !== 2 ||
    !Array.isArray(request_ids) || request_ids.length > 80 ||
    !Array.isArray(media_ids) || media_ids.length > 20 ||
    new Set(actor_ids.map(id => uuid(id))).size !== 2 ||
    new Set(request_ids.map(id => uuid(id))).size !== request_ids.length ||
    new Set(media_ids.map(id => uuid(id))).size !== media_ids.length) {
    throw new Error('Invalid Staging cleanup scope');
  }
  return {
    run: uuid(run_id), source: uuid(source), account: uuid(account), variant: uuid(variant),
    actors: 'array[' + actor_ids.map(uuid).join(',') + ']::uuid[]',
    requests: 'array[' + request_ids.map(uuid).join(',') + ']::uuid[]',
    media: 'array[' + media_ids.map(uuid).join(',') + ']::uuid[]',
  };
}

function taskScope({ source, variant, account, requests }) {
  return `t.post_id=${source} or t.variant_id=${variant} or t.account_id=${account}
    or exists (select 1 from public.distribution_publish_logs l where l.task_id=t.id and l.request_id=any(${requests}))`;
}

export function publishRunDatabaseReadback(scope) {
  const sql = scopeSql(scope);
  return `with tasks as (
    select t.id from public.distribution_publish_tasks t where ${taskScope(sql)}
  )
  select
    exists(select 1 from public.distribution_accounts where id=${sql.account}) as account_exists,
    exists(select 1 from public.distribution_posts where id=${sql.source}) as source_exists,
    exists(select 1 from public.distribution_variants where id=${sql.variant} or post_id=${sql.source} or account_id=${sql.account}) as variant_exists,
    exists(select 1 from public.distribution_post_targets where post_id=${sql.source} or account_id=${sql.account}) as target_exists,
    exists(select 1 from public.distribution_post_media where post_id=${sql.source}) as source_media_exists,
    exists(select 1 from public.distribution_variant_media where variant_id=${sql.variant}) as variant_media_exists,
    exists(select 1 from tasks) as tasks_exist,
    exists(select 1 from public.distribution_publish_task_media where task_id in (select id from tasks)) as task_media_exists,
    exists(select 1 from public.distribution_publish_logs where task_id in (select id from tasks) or request_id=any(${sql.requests})) as logs_exist;`;
}

function isAbsent(rows) {
  const fields = ['account_exists','source_exists','variant_exists','target_exists','source_media_exists',
    'variant_media_exists','tasks_exist','task_media_exists','logs_exist'];
  check(rows?.length === 1 && fields.every(field => typeof rows[0]?.[field] === 'boolean'),
    'Unexpected cleanup readback', {}, 'P1');
  return fields.every(field => rows[0][field] === false);
}

export async function cleanPublishRunDatabase(database, scope, evidence = () => {}) {
  const readback = publishRunDatabaseReadback(scope);
  async function readAbsent() {
    try {
      return isAbsent(await database.read(readback));
    } catch (error) {
      evidence(error);
      throw new ProbeError('FAIL', 'M3 database cleanup could not be verified', {}, 'P1');
    }
  }
  if (await readAbsent()) return 'already_absent';
  let missingReceipt;
  try {
    await database.write(publishRunDatabaseCleanup(scope));
  } catch (error) {
    missingReceipt = error;
    evidence(error);
  }
  if (!await readAbsent()) throw new ProbeError('FAIL', 'M3 database cleanup readback still contains scoped data', {}, 'P1');
  return missingReceipt ? 'confirmed_by_readback' : 'deleted';
}

// Execute only through a trusted SQL connection scoped to the named Staging
// project. Application roles have no path to delete publishing history.
export function publishRunDatabaseCleanup(scope) {
  const sql = scopeSql(scope);
  return [
    'begin;',
    'set local row_security = off;',
    'set local lock_timeout = \'5s\';',
    'set local statement_timeout = \'15s\';',
    'do $cleanup$',
    'declare run_id constant uuid := ' + sql.run + '; marker text := \'M3 integration \' || run_id::text;',
    '  run_source constant uuid := ' + sql.source + '; run_account constant uuid := ' + sql.account + '; run_variant constant uuid := ' + sql.variant + ';',
    '  actors constant uuid[] := ' + sql.actors + '; requests constant uuid[] := ' + sql.requests + '; media constant uuid[] := ' + sql.media + ';',
    '  tasks uuid[];',
    'begin',
    '  perform pg_advisory_xact_lock(hashtextextended(\'M3 staging cleanup \' || run_id::text, 0));',
    '  perform 1 from public.distribution_posts where id=run_source for update;',
    '  perform 1 from public.distribution_accounts where id=run_account for update;',
    '  perform 1 from public.distribution_variants where id=run_variant for update;',
    '  perform 1 from public.distribution_publish_tasks t where ' + taskScope(sql) + ' for update;',
    '  if not exists (select 1 from public.distribution_posts where id=run_source)',
    '    and not exists (select 1 from public.distribution_accounts where id=run_account)',
    '    and not exists (select 1 from public.distribution_variants where id=run_variant)',
    '    and not exists (select 1 from public.distribution_publish_tasks t where ' + taskScope(sql) + ')',
    '    and not exists (select 1 from public.distribution_publish_logs where request_id=any(requests))',
    '  then return; end if;',
    '  if (select count(*) from auth.users where id=any(actors) and raw_app_meta_data->>\'distribution_staging_run_id\'=run_id::text) <> 2 then',
    '    raise exception \'M3 cleanup requires both verified run-owned Auth actors\'; end if;',
    '  if exists (select 1 from public.distribution_posts where id=run_source and (title<>marker || \' source\' or status<>\'draft\'))',
    '    or exists (select 1 from public.distribution_accounts where id=run_account and (name<>marker || \' account\' or notes<>marker))',
    '    or exists (select 1 from public.distribution_variants v where (v.post_id=run_source or v.account_id=run_account or v.id=run_variant)',
    '      and (v.id<>run_variant or v.post_id<>run_source or v.account_id<>run_account or v.title not in (marker || \' v1\', marker || \' v2\',marker || \' source\')))',
    '    or exists (select 1 from public.distribution_post_targets t where (t.post_id=run_source or t.account_id=run_account)',
    '      and (t.post_id<>run_source or t.account_id<>run_account))',
    '    or exists (select 1 from public.distribution_publish_tasks t where (' + taskScope(sql) + ')',
    '      and (t.post_id<>run_source or t.variant_id<>run_variant or t.account_id<>run_account or t.plan_note<>marker',
    '        or not t.created_by=any(actors) or not t.updated_by=any(actors) or not exists (',
    '          select 1 from public.distribution_publish_logs l where l.task_id=t.id and l.event_type=\'task_created\'',
    '            and l.task_version=1 and l.request_id=any(requests) and l.actor_id=t.created_by)))',
    '  then raise exception \'M3 cleanup scope includes a resource without the run marker\'; end if;',
    '  select coalesce(array_agg(t.id),array[]::uuid[]) into tasks from public.distribution_publish_tasks t',
    '    where t.post_id=run_source and t.variant_id=run_variant and t.account_id=run_account;',
    '  if exists (select 1 from public.distribution_post_media m where m.post_id=run_source and not m.media_id=any(media))',
    '    or exists (select 1 from public.distribution_variant_media m where m.variant_id=run_variant and not m.media_id=any(media))',
    '    or exists (select 1 from public.distribution_publish_task_media m where m.task_id=any(tasks) and not m.media_id=any(media))',
    '  then raise exception \'M3 cleanup found a media link outside the run manifest\'; end if;',
    '  if exists (select 1 from public.distribution_publish_logs l where (l.task_id=any(tasks) or l.request_id=any(requests))',
    '    and not (l.task_id=any(tasks) and l.actor_id=any(actors) and l.request_id=any(requests)))',
    '  then raise exception \'M3 cleanup found an event outside the run manifest\'; end if;',
    '  delete from public.distribution_publish_logs where task_id=any(tasks);',
    '  delete from public.distribution_publish_task_media where task_id=any(tasks);',
    '  delete from public.distribution_publish_tasks where id=any(tasks);',
    '  delete from public.distribution_posts where id=run_source and title=marker || \' source\' and status=\'draft\';',
    '  delete from public.distribution_accounts where id=run_account and name=marker || \' account\' and notes=marker;',
    '  if exists (select 1 from public.distribution_publish_tasks where id=any(tasks))',
    '    or exists (select 1 from public.distribution_publish_logs where task_id=any(tasks) or request_id=any(requests))',
    '    or exists (select 1 from public.distribution_publish_task_media where task_id=any(tasks))',
    '    or exists (select 1 from public.distribution_posts where id=run_source)',
    '    or exists (select 1 from public.distribution_variants where id=run_variant)',
    '    or exists (select 1 from public.distribution_accounts where id=run_account)',
    '  then raise exception \'Run database cleanup verification failed\'; end if;',
    'end $cleanup$;',
    'commit;',
  ].join('\n');
}
