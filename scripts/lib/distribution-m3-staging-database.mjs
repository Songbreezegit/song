import { readFile } from 'node:fs/promises';
import { check, isStagingResourceUuid, ProbeError } from './distribution-staging-target.mjs';

const migration = 'protect_distribution_publish_media';
const originalHash = 'c9aa94c8a63df0fb8e521bf77c5bbb9bb71755bbf496224ea8f30dc12e260396';
const repo = new URL('../../', import.meta.url);

export function createPublishStagingDatabase(target, token) {
  if (target.ref !== 'uartrtcmskyuqxawjqlx' || !token?.startsWith('sbp_fc')) {
    throw new ProbeError('BLOCKED', 'A project-scoped song-staging database credential is required', {}, 'P1');
  }
  const endpoint = 'https://api.supabase.com/v1/projects/' + target.ref + '/database/query';

  async function query(sql, readOnly = false) {
    await target.verifyProject();
    let response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(25000),
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: sql, read_only: readOnly }),
      });
    } catch {
      throw new ProbeError('BLOCKED', 'Staging SQL response unavailable');
    }
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      const sqlstate = [body?.code, body?.error?.code, body?.details?.code].find(code => /^[0-9A-Z]{5}$/.test(code ?? ''));
      const unavailable = response.status === 401 || response.status === 403 || response.status === 429 || (response.status >= 500 && !sqlstate);
      throw new ProbeError(unavailable ? 'BLOCKED' : 'FAIL', 'Staging SQL request rejected', { http: response.status, sqlstate });
    }
    if (response.status === 204) return [];
    const rows = await response.json().catch(() => null);
    if (!Array.isArray(rows)) throw new ProbeError('BLOCKED', 'Staging SQL receipt was not an array');
    return rows;
  }

  return {
    read: select => query(select, true),
    write: query,
  };
}

const quotedUuid = id => {
  if (!isStagingResourceUuid(id)) throw new Error('Invalid Staging fixture UUID');
  return "'" + id.toLowerCase() + "'::uuid";
};

export async function verifyPublishStagingSchema(database, mode, expectedHash) {
  const [state] = await database.read(`select
    (select encode(sha256(convert_to(statements[1],'UTF8')),'hex') from supabase_migrations.schema_migrations
      where version='20261113062649' and name='add_distribution_publish_calendar' and cardinality(statements)=1) as original_sha256,
    (select count(*)::int from supabase_migrations.schema_migrations where name='${migration}') as guard_records,
    (select max(version) from supabase_migrations.schema_migrations where name='${migration}') as guard_version,
    (select max(encode(sha256(convert_to(statements[1],'UTF8')),'hex')) from supabase_migrations.schema_migrations
      where name='${migration}' and cardinality(statements)=1) as guard_sha256,
    exists(select 1 from pg_trigger where tgrelid='storage.objects'::regclass and tgname='distribution_protect_task_media') as guard_trigger,
    exists(select 1 from pg_trigger t join pg_proc p on p.oid=t.tgfoid
      where t.tgrelid='storage.objects'::regclass and t.tgname='distribution_protect_task_media' and t.tgenabled in ('O','A')
        and t.tgtype=17 and p.pronamespace='distribution_publish_private'::regnamespace and p.proname='protect_task_media'
        and p.prosecdef and p.provolatile='v' and p.proconfig @> array['search_path=""','row_security=off']
        and not has_function_privilege('anon',p.oid,'EXECUTE')
        and not has_function_privilege('authenticated',p.oid,'EXECUTE')
        and not has_function_privilege('service_role',p.oid,'EXECUTE')
        and not has_function_privilege('distribution_publish_writer',p.oid,'EXECUTE')
        and exists(select 1 from pg_roles r where r.oid=p.proowner and (r.rolbypassrls or r.rolsuper))) as guard_active,
    to_regprocedure('distribution_publish_private.protect_task_media()') is not null as guard_function,
    (select coalesce(to_jsonb(b)->>'versioning_status','DISABLED') from storage.buckets b where id='media') as bucket_versioning,
    current_setting('transaction_read_only')='on' as read_only,
    not exists(select 1 from public.admin_users) as empty_admins;`);
  const expected = mode === 'baseline' ? state?.guard_records === 0 && !state.guard_trigger && !state.guard_function
    : state?.guard_records === 1 && state.guard_active && state.guard_sha256 === expectedHash;
  if (state?.original_sha256 !== originalHash || !expected || state.bucket_versioning !== 'DISABLED'
    || !state.read_only || !state.empty_admins) {
    throw new ProbeError('BLOCKED', 'Staging migration hash, media guard or bucket mode did not match the approved run', {}, 'P1');
  }
  return { migration_version: state.guard_version, migration_sha256: state.guard_sha256, bucket_versioning: state.bucket_versioning };
}

export async function registerPublishStagingAdmins(database, runId, actorIds, memberId) {
  const marker = quotedUuid(runId);
  const first = quotedUuid(actorIds[0]), second = quotedUuid(actorIds[1]), member = quotedUuid(memberId);
  check(new Set([first, second, member]).size === 3, 'Staging Auth fixtures must be separate', {}, 'P1');
  const smoke = name => readFile(new URL('supabase/tests/' + name + '.sql', repo), 'utf8');
  const [m1, m2, m3] = await Promise.all(['distribution_security_smoke', 'distribution_m2_security_smoke',
    'distribution_m3_security_smoke'].map(smoke));
  await database.write(`begin;
    set local lock_timeout='5s';
    lock table public.admin_users in share row exclusive mode;
    do $register$
    begin
      if exists(select 1 from public.admin_users) or (select count(*) from auth.users
        where raw_app_meta_data->>'distribution_staging_run_id'=${marker}::text and id in (${first},${second},${member}))<>3
      then raise exception 'Staging administrator registration scope mismatch'; end if;
      insert into public.admin_users(user_id) values (${first});
    end $register$;
    commit;`);
  // Existing smoke files open their own read-only transactions and roll back.
  const m1Result = await database.write(m1);
  check(m1Result.some(row => row.verification?.passed && row.verification.contexts === 5), 'M1 Staging SQL smoke', {}, 'P1');
  await database.write(`begin;
    set local lock_timeout='5s';
    lock table public.admin_users in share row exclusive mode;
    do $register$
    begin
      if (select count(*) from auth.users
        where id in (${first},${second}) and raw_app_meta_data->>'distribution_staging_run_id'=${marker}::text)<>2
        or not exists (select 1 from public.admin_users where user_id=${first})
        or exists (select 1 from public.admin_users where user_id<>${first})
      then raise exception 'Second Staging administrator scope mismatch'; end if;
      insert into public.admin_users(user_id) values (${second});
    end $register$;
    commit;`);
  for (const [name, sql] of [['M2', m2], ['M3', m3]]) {
    const rows = await database.write(sql);
    check(rows.some(row => row.verification?.passed && row.verification.contexts === 5), name + ' Staging SQL smoke', {}, 'P1');
  }
}

export async function probePublishStagingAtomicity(database, runId, actorId, task) {
  const template = await readFile(new URL('supabase/tests/distribution_m3_atomic_rollback.sql', repo), 'utf8');
  const ids = [runId, task.id, actorId].map(quotedUuid);
  let index = 0;
  check(Number.isInteger(task.version) && task.version > 0, 'Valid atomic probe task revision', {}, 'P1');
  const sql = template.replace(/'00000000-0000-0000-0000-000000000000'/g, () => ids[index++])
    .replace('task_revision integer := 0;', 'task_revision integer := ' + task.version + ';');
  check(index === 3, 'Atomic probe fixture substitutions matched', {}, 'P1');
  const rows = await database.write(sql);
  check(rows.some(row => row.verification?.passed && row.verification.transaction_rolled_back), 'Scoped Staging audit rollback', {}, 'P1');
  const [result] = await database.read(`select version, status, not exists(select 1 from pg_trigger
    where tgrelid='public.distribution_publish_logs'::regclass and tgname='m3_test_reject_audit') as trigger_absent
    from public.distribution_publish_tasks where id=${quotedUuid(task.id)};`);
  check(result?.trigger_absent && result.version === task.version && result.status === task.status,
    'Audit rollback left the task unchanged and removed the probe trigger', {}, 'P1');
}

export async function verifyPublishStagingAuthCleanup(database, runId, people) {
  const run = quotedUuid(runId);
  const users = 'array[' + people.map(quotedUuid).join(',') + ']::uuid[]';
  const [row] = await database.read(`select
    (select count(*)::int from auth.users where id=any(${users})
      or raw_app_meta_data->>'distribution_staging_run_id'=${run}::text) as users,
    (select count(*)::int from auth.mfa_factors where user_id=any(${users})) as factors,
    (select count(*)::int from auth.sessions where user_id=any(${users})) as sessions,
    (select count(*)::int from auth.identities where user_id=any(${users})) as identities,
    (select count(*)::int from public.admin_users where user_id=any(${users})) as admins;`);
  check(row && ['users','factors','sessions','identities','admins'].every(field => row[field] === 0),
    'No run Auth users, factors, sessions, identities or admin registrations remain', row, 'P1');
  return row;
}
