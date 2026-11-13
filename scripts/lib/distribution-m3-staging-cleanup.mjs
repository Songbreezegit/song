import { isStagingResourceUuid } from './distribution-staging-target.mjs';

const project = 'uartrtcmskyuqxawjqlx';

function uuid(value) {
  if (!isStagingResourceUuid(value)) throw new Error('Invalid run resource UUID');
  return "'" + value.toLowerCase() + "'::uuid";
}

// Execute only through a trusted SQL connection scoped to the named Staging
// project. Application roles have no path to delete publishing history.
export function publishRunDatabaseCleanup({ project_ref, run_id, actor_ids, source, account, variant, request_ids }) {
  if (project_ref !== project || !Array.isArray(actor_ids) || actor_ids.length !== 2 ||
    !Array.isArray(request_ids) || request_ids.length > 80 || new Set(actor_ids).size !== 2) {
    throw new Error('Invalid Staging cleanup scope');
  }
  const run = uuid(run_id);
  const sourceId = uuid(source), accountId = uuid(account), variantId = uuid(variant);
  const actors = 'array[' + actor_ids.map(uuid).join(',') + ']::uuid[]';
  const requests = 'array[' + request_ids.map(uuid).join(',') + ']::uuid[]';
  return [
    'begin;',
    'set local row_security = off;',
    'set local lock_timeout = \'5s\';',
    'do $cleanup$',
    'declare run_id constant uuid := ' + run + '; marker text := \'M3 integration \' || run_id::text;',
    '  run_source constant uuid := ' + sourceId + '; run_account constant uuid := ' + accountId + '; run_variant constant uuid := ' + variantId + ';',
    '  actors constant uuid[] := ' + actors + '; requests constant uuid[] := ' + requests + ';',
    '  tasks uuid[];',
    'begin',
    '  if (select count(*) from auth.users where id=any(actors) and raw_app_meta_data->>\'distribution_staging_run_id\'=run_id::text) <> 2 then',
    '    raise exception \'M3 cleanup requires both verified run-owned Auth actors\'; end if;',
    '  perform 1 from public.distribution_posts where id=run_source for update;',
    '  perform 1 from public.distribution_accounts where id=run_account for update;',
    '  perform 1 from public.distribution_variants where id=run_variant for update;',
    '  perform 1 from public.distribution_publish_tasks t where t.post_id=run_source or t.variant_id=run_variant or t.account_id=run_account for update;',
    '  if exists (select 1 from public.distribution_posts where id=run_source and (title<>marker || \' source\' or status<>\'draft\'))',
    '    or exists (select 1 from public.distribution_accounts where id=run_account and (name<>marker || \' account\' or notes<>marker))',
    '    or exists (select 1 from public.distribution_variants v where (v.post_id=run_source or v.account_id=run_account or v.id=run_variant)',
    '      and (v.id<>run_variant or v.post_id<>run_source or v.account_id<>run_account or v.title not in (marker || \' v1\', marker || \' v2\',marker || \' source\')))',
    '    or exists (select 1 from public.distribution_post_targets t where (t.post_id=run_source or t.account_id=run_account)',
    '      and (t.post_id<>run_source or t.account_id<>run_account))',
    '    or exists (select 1 from public.distribution_publish_tasks t where (t.post_id=run_source or t.variant_id=run_variant or t.account_id=run_account)',
    '      and (t.post_id<>run_source or t.variant_id<>run_variant or t.account_id<>run_account or t.plan_note<>marker',
    '        or not t.created_by=any(actors) or not t.updated_by=any(actors) or not exists (',
    '          select 1 from public.distribution_publish_logs l where l.task_id=t.id and l.event_type=\'task_created\'',
    '            and l.task_version=1 and l.request_id=any(requests) and l.actor_id=t.created_by)))',
    '  then raise exception \'M3 cleanup scope includes a resource without the run marker\'; end if;',
    '  select coalesce(array_agg(t.id),array[]::uuid[]) into tasks from public.distribution_publish_tasks t',
    '    where t.post_id=run_source and t.variant_id=run_variant and t.account_id=run_account;',
    '  if exists (select 1 from public.distribution_publish_logs l where l.task_id=any(tasks)',
    '    and (not l.actor_id=any(actors) or not l.request_id=any(requests)))',
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
