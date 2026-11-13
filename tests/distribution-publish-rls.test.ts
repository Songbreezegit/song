import { PGlite } from '@electric-sql/pglite';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { PublishTask } from '../src/types/distributionPublish';
import { publishRunDatabaseCleanup } from '../scripts/lib/distribution-m3-staging-cleanup.mjs';

const db = new PGlite();
const admin = randomUUID(), secondAdmin = randomUUID(), member = randomUUID();
const image = randomUUID(), replacement = randomUUID();
const variantFields = { title: '冻结版标题', body: '冻结版正文', tags: ['松屿'], content_type: 'image_text', status: 'ready' };
const imageLink = (media_id: string) => ({ media_id, is_cover: true, aspect_ratio_hint: '3:4', processing_notes: '保留封面' });

async function asRole<T>(user: string, aal: string, run: () => Promise<T>, role = 'authenticated') {
  await db.exec("set role " + role + "; set request.jwt.claim.sub='" + user + "'; set request.jwt.claim.aal='" + aal + "';");
  try { return await run(); }
  finally { await db.exec('reset role; reset request.jwt.claim.sub; reset request.jwt.claim.aal;'); }
}
const asAdmin = <T,>(run: () => Promise<T>) => asRole(admin, 'aal2', run);
const migrations = 'supabase/migrations/';

async function rpc<T>(sql: string, args: unknown[]) {
  return (await db.query<{ result: T }>(sql, args)).rows[0].result;
}
async function fixtures(asset = image, marker?: string) {
  const post = randomUUID(), variant = randomUUID(), account = randomUUID();
  await db.query("insert into distribution_accounts(id,platform,name,profile_url,notes) values ($1,'other',$2,'https://example.com/profile',$3)",
    [account, marker ? marker + ' account' : '测试账号', marker ?? '']);
  await db.query('select save_distribution_post($1,null,$2::jsonb,$3::uuid[],array[]::uuid[])', [
    post, { ...variantFields, title: marker ? marker + ' source' : variantFields.title, status: 'draft', project_id: null, promotion_goal: 'awareness' }, [account],
  ]);
  await db.query('select create_distribution_variant($1,$2,$3)', [variant, post, account]);
  const { version } = await saveVariant(variant, 1, asset, marker ? marker + ' v1' : variantFields.title);
  return { post, account, variant, version };
}
const saveVariant = (id: string, version: number, media: string, title = variantFields.title) =>
  rpc<{ version: number }>('select save_distribution_variant($1,$2,$3::jsonb,$4::jsonb) result',
    [id, version, { ...variantFields, title }, JSON.stringify([imageLink(media)])]);

const future = () => new Date(Date.now() + 48 * 3600_000).toISOString();
const createInput = (v: { variant: string; version: number }) => ({
  variant_id: v.variant, variant_version: v.version, scheduled_at: future(), timezone: 'Asia/Shanghai', plan_note: '晚间手动发布',
});
const change = (action: string, task: Pick<PublishTask, 'id' | 'version'> | null, payload: object = {}, request = randomUUID()) =>
  rpc<PublishTask>('select change_distribution_publish_task($1,$2,$3,$4,$5::jsonb) result',
    [request, action, task?.id ?? null, task?.version ?? null, payload]);
const read = (id: string) => rpc<PublishTask>('select to_jsonb(t) result from distribution_publish_tasks t where id=$1', [id]);
const logs = (id: string) => db.query<{ event_type: string; actor_id: string; old_state: PublishTask; new_state: PublishTask; metadata: Record<string, string> }>(
  'select event_type,actor_id,old_state,new_state,metadata from distribution_publish_logs where task_id=$1 order by task_version', [id]);
const reportInput = (task: PublishTask) => ({ published_at: new Date(Date.now() - 60_000).toISOString(),
  external_url: 'https://example.com/post/42', report_note: '', account_id: task.account_id, variant_version: task.variant_version });

let baselinePolicies: unknown[];
const oldPolicies = async () => (await db.query("select * from pg_policies where tablename not like 'distribution_publish_%' order by schemaname,tablename,policyname")).rows;

beforeAll(async () => {
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls; create role authenticator;" +
    "create schema auth; create schema storage;" +
    "create table auth.users(id uuid primary key,raw_app_meta_data jsonb);" +
    "create table auth.mfa_factors(user_id uuid,status text,factor_type text);" +
    "create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;" +
    "create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('aal',nullif(current_setting('request.jwt.claim.aal',true),'')) $$;" +
    "create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);" +
    "create table storage.objects(id uuid primary key,bucket_id text,name text,metadata jsonb);" +
    "alter table storage.objects enable row level security;" +
    "grant usage on schema auth,storage,public to anon,authenticated;" +
    "grant select,insert,update,delete on storage.objects to anon,authenticated;");
  for (const name of readdirSync(migrations).filter(name => name.endsWith('.sql')).sort()) {
    if (name.includes('enforce_admin_mfa')) {
      await db.query('insert into auth.users(id) values ($1),($2),($3)', [admin, secondAdmin, member]);
      await db.query('insert into admin_users(user_id) values ($1)', [admin]);
      await db.query("insert into auth.mfa_factors values ($1,'verified','totp')", [admin]);
    }
    if (name.includes('add_distribution_publish_calendar')) baselinePolicies = await oldPolicies();
    await db.exec(readFileSync(migrations + name, 'utf8'));
    if (name.includes('enforce_admin_mfa')) await db.query('insert into admin_users(user_id) values ($1)', [secondAdmin]);
  }
  await db.query("insert into storage.objects values ($1,'media','original.webp',$3),($2,'media','replacement.webp',$3)",
    [image, replacement, { mimetype: 'image/webp' }]);
}, 30_000);
afterAll(async () => { await db.close(); });

it('keeps pre-M3 policies and declares forced RLS, RESTRICT foreign keys and ordered indexes', async () => {
  expect(await oldPolicies()).toEqual(baselinePolicies);
  expect((await db.query("select relrowsecurity,relforcerowsecurity from pg_class where relname in ('distribution_publish_tasks','distribution_publish_task_media','distribution_publish_logs')")).rows)
    .toEqual(Array(3).fill({ relrowsecurity: true, relforcerowsecurity: true }));
  expect((await db.query("select confdeltype from pg_constraint where contype='f' and conrelid in ('distribution_publish_tasks'::regclass,'distribution_publish_task_media'::regclass,'distribution_publish_logs'::regclass)")).rows)
    .toEqual(Array(6).fill({ confdeltype: 'r' }));
  expect((await db.query("select indexdef from pg_indexes where indexname='distribution_publish_tasks_schedule_idx'")).rows[0])
    .toMatchObject({ indexdef: expect.stringContaining('(scheduled_at, id)') });
  expect((await db.query("select rolcanlogin, rolbypassrls, rolsuper, " +
    "pg_has_role('authenticated', oid, 'SET') as client_can_assume, " +
    "has_schema_privilege('authenticated','distribution_publish_private','USAGE') as client_can_name_private, " +
    "has_table_privilege(oid,'public.distribution_publish_logs','UPDATE, DELETE') as writer_can_rewrite " +
    "from pg_roles where rolname='distribution_publish_writer'")).rows).toEqual([{
    rolcanlogin: false, rolbypassrls: false, rolsuper: false, client_can_assume: false, client_can_name_private: false, writer_can_rewrite: false,
  }]);
});

it.each([['anon', '', ''], ['authenticated', member, 'aal2'], ['authenticated', admin, 'aal1']])(
  'denies table and RPC access to %s with %s / %s', async (role, user, aal) => {
    const v = await asAdmin(fixtures);
    await asAdmin(() => change('create', null, createInput(v)));
    await asRole(user, aal, async () => {
      for (const table of ['distribution_publish_tasks', 'distribution_publish_task_media', 'distribution_publish_logs']) {
        const query = db.query('select * from ' + table);
        if (role === 'anon') await expect(query).rejects.toMatchObject({ code: '42501' });
        else expect((await query).rows).toEqual([]);
      }
      await expect(change('create', null, createInput(v))).rejects.toMatchObject({ code: '42501' });
    }, role);
  },
);

it('passes the deployed-schema read-only smoke across five policy contexts', async () => {
  const result = await db.exec(readFileSync('supabase/tests/distribution_m3_security_smoke.sql', 'utf8'));
  expect(result.flatMap(part => part.rows)).toContainEqual({ verification: { passed: true, contexts: 5, writes_executed: false } });
});

it('keeps MFA restrictive even when extra permissive SELECT policies are added', async () => {
  await db.exec('create policy test_permissive on distribution_publish_tasks for select to authenticated using (true)');
  try {
    await asRole(admin, 'aal1', async () => expect((await db.query('select id from distribution_publish_tasks')).rows).toEqual([]));
    await asRole(member, 'aal2', async () => expect((await db.query('select id from distribution_publish_tasks')).rows).toEqual([]));
  } finally { await db.exec('drop policy test_permissive on distribution_publish_tasks'); }
});

it('rejects direct task mutation, forged and rewritten logs, and direct access to the private writer', async () => {
  await asAdmin(async () => {
    const task = await change('create', null, createInput(await fixtures()));
    for (const sql of [
      "update distribution_publish_tasks set status='cancelled' where id=$1",
      "update distribution_publish_tasks set content_snapshot='{}'::jsonb where id=$1",
      'delete from distribution_publish_tasks where id=$1',
      'insert into distribution_publish_logs(task_id) values ($1)',
      "update distribution_publish_logs set metadata='{}'::jsonb where task_id=$1",
      'delete from distribution_publish_logs where task_id=$1',
      'delete from distribution_publish_task_media where task_id=$1',
    ]) await expect(db.query(sql, [task.id])).rejects.toMatchObject({ code: '42501' });
    await expect(db.query("select distribution_publish_private.change_task(gen_random_uuid(),'start',$1,1,'{}')", [task.id]))
      .rejects.toMatchObject({ code: '42501' });
    expect((await logs(task.id)).rows).toHaveLength(1);
  });
});

it('supports repeat scheduling and exact replay, including after a later update, without duplicating an event', async () => {
  const input = createInput(await asAdmin(fixtures)), request = randomUUID();
  const first = await asAdmin(() => change('create', null, input, request));
  const second = await asAdmin(() => change('create', null, input));
  expect(second.id).not.toBe(first.id);
  expect(second.content_snapshot).toMatchObject({ variant_id: first.variant_id, title: first.title });
  const rescheduled = await asAdmin(() => change('reschedule', first, { scheduled_at: first.scheduled_at, timezone: 'Asia/Tokyo', plan_note: '改时区' }));
  expect(rescheduled.version).toBe(2);
  expect(await asAdmin(() => change('create', null, input, request))).toEqual(first);
  await expect(asAdmin(() => change('create', null, { ...input, plan_note: 'other' }, request))).rejects.toMatchObject({ code: 'PT409' });
  await expect(asRole(secondAdmin, 'aal2', () => change('create', null, input, request))).rejects.toMatchObject({ code: 'PT409' });
  expect((await asAdmin(() => logs(first.id))).rows.map(row => row.event_type)).toEqual(['task_created', 'task_rescheduled']);
});

it('freezes snapshots, blocks source deletion, and retains media of explicitly superseded snapshots', async () => {
  const originalAsset = randomUUID();
  await db.query("insert into storage.objects values ($1,'media','frozen.webp',$2)", [originalAsset, { mimetype: 'image/webp' }]);
  const v = await asAdmin(() => fixtures(originalAsset));
  const original = await asAdmin(() => change('create', null, createInput(v)));
  const latest = await asAdmin(() => saveVariant(v.variant, v.version, replacement, '新平台稿'));
  expect(await asAdmin(() => read(original.id))).toEqual(original);
  expect(original.content_snapshot.media[0]).toMatchObject({ media_id: originalAsset, sort_order: 0, is_cover: true, processing_notes: '保留封面' });
  await expect(asAdmin(() => db.query('delete from distribution_posts where id=$1', [v.post]))).rejects.toMatchObject({
    code: expect.stringMatching(/^(23503|23001)$/), constraint: expect.stringMatching(/^distribution_publish_tasks_(post|variant)_id_fkey$/),
  });
  await expect(asAdmin(() => change('refresh_snapshot', original, { variant_version: v.version }))).rejects.toMatchObject({ code: 'PT409' });
  const changed = await asAdmin(() => change('refresh_snapshot', original, { variant_version: latest.version }));
  expect(changed).toMatchObject({ title: '新平台稿', variant_version: latest.version, version: 2 });
  expect(changed.content_snapshot.media[0].media_id).toBe(replacement);
  const events = (await asAdmin(() => logs(original.id))).rows;
  expect(events[1]).toMatchObject({ event_type: 'task_snapshot_updated', old_state: original, new_state: changed });
  expect((await db.query('select variant_id from distribution_variant_media where media_id=$1', [originalAsset])).rows).toEqual([]);
  await expect(db.query('delete from storage.objects where id=$1', [originalAsset])).rejects.toMatchObject({
    code: expect.stringMatching(/^(23503|23001)$/), constraint: 'distribution_publish_task_media_media_id_fkey',
  });
});

it('allows history and follow-up on archived accounts while rejecting new plans, detached targets and stale variants', async () => {
  const v = await asAdmin(fixtures);
  const task = await asAdmin(() => change('create', null, createInput(v)));
  await asAdmin(async () => {
    await expect(change('create', null, createInput({ ...v, version: v.version + 1 }))).rejects.toMatchObject({ code: 'PT409' });
    await db.query('delete from distribution_post_targets where post_id=$1 and account_id=$2', [v.post, v.account]);
    await expect(change('create', null, createInput(v))).rejects.toMatchObject({ code: 'PT409' });
    await db.query('insert into distribution_post_targets(post_id,account_id) values ($1,$2)', [v.post, v.account]);
    await db.query('update distribution_accounts set archived_at=clock_timestamp() where id=$1', [v.account]);
    await expect(change('create', null, createInput(v))).rejects.toMatchObject({ code: 'PT409' });
    expect(await read(task.id)).toEqual(task);
    expect(await change('cancel', task, { reason: '账号归档' })).toMatchObject({ status: 'cancelled' });
  });
});

it('enforces manual evidence, versions, terminal states, report replay and audited correction', async () => {
  const task = await asAdmin(async () => change('create', null, createInput(await fixtures())));
  await asAdmin(async () => {
    await expect(change('report', task, reportInput(task))).rejects.toMatchObject({ code: '22023' });
    const started = await change('start', task);
    await expect(change('cancel', task, { reason: '旧版本' })).rejects.toMatchObject({ code: 'PT409' });
    const returned = await change('return', started, { reason: '先核对素材' });
    const again = await change('start', returned);
    const report = reportInput(again), request = randomUUID();
    for (const url of ['javascript:alert(1)', 'https://', 'https://host.test:65536/path', 'https://user@host.test/', 'https://host.test/%oops']) {
      await expect(change('report', again, { ...report, external_url: url })).rejects.toMatchObject({ code: '22023' });
    }
    await expect(change('report', again, { ...report, external_url: '' })).rejects.toMatchObject({ code: '22023' });
    await expect(change('report', again, { ...report, published_at: future() })).rejects.toMatchObject({ code: '22023' });
    const reported = await change('report', again, report, request);
    expect(reported).toMatchObject({ status: 'manually_reported', reported_by: admin, report_evidence: 'manual_user_report', external_url: report.external_url });
    expect(await change('report', again, report, request)).toEqual(reported);
    await expect(change('start', reported)).rejects.toMatchObject({ code: '22023' });
    await expect(change('refresh_snapshot', reported, { variant_version: reported.variant_version + 1 })).rejects.toMatchObject({ code: '22023' });
    const corrected = await change('correct_report', reported, { ...report, external_url: 'https://example.com/fixed', reason: '修正作品链接' });
    expect(corrected.reported_at).toBe(reported.reported_at);
    expect(corrected.content_snapshot).toEqual(reported.content_snapshot);
    expect((await logs(task.id)).rows.map(row => row.event_type)).toEqual(
      ['task_created', 'task_started', 'task_returned', 'task_started', 'manual_reported', 'manual_report_corrected']);
    expect((await logs(task.id)).rows.at(-1)).toMatchObject({ old_state: reported, new_state: corrected, metadata: { reason: '修正作品链接', evidence: 'manual_user_report' } });
  });
});

it('rolls back the new task and media when an audit insert fails, then accepts the same request', async () => {
  const variant = await asAdmin(fixtures);
  const payload = createInput(variant), request = randomUUID();
  await db.exec("create function public.test_reject_audit() returns trigger language plpgsql as $$ begin raise exception 'injected audit failure'; end $$;" +
    "create trigger test_reject_audit before insert on distribution_publish_logs for each row when (new.request_id='" + request + "') execute function public.test_reject_audit();");
  try {
    await expect(asAdmin(() => change('create', null, payload, request))).rejects.toMatchObject({ code: 'P0001' });
    expect((await db.query('select id from distribution_publish_tasks where variant_id=$1', [variant.variant])).rows).toEqual([]);
    expect((await db.query('select id from distribution_publish_logs where request_id=$1', [request])).rows).toEqual([]);
  } finally { await db.exec('drop trigger test_reject_audit on distribution_publish_logs; drop function public.test_reject_audit();'); }
  const saved = await asAdmin(() => change('create', null, payload, request));
  expect((await db.query('select media_id from distribution_publish_task_media where task_id=$1', [saved.id])).rows).toEqual([{ media_id: image }]);
});

it('rejects past plans, unready variants and forged inputs without mutating a task', async () => {
  const v = await asAdmin(fixtures);
  await asAdmin(async () => {
    const input = createInput(v);
    for (const invalid of [{ scheduled_at: '2020-01-01T10:00:00Z' }, { scheduled_at: '2099-01-01T10:00:00' },
      { timezone: 'Europe/Imaginary' }, { status: 'manually_reported' }, { plan_note: 'x'.repeat(2001) }]) {
      await expect(change('create', null, { ...input, ...invalid })).rejects.toMatchObject({ code: expect.stringMatching(/^22|^23514/) });
    }
    await db.query("update distribution_variants set status='draft' where id=$1", [v.variant]);
    await expect(change('create', null, createInput({ ...v, version: v.version + 1 }))).rejects.toMatchObject({ code: '22023' });
  });
});

it('validates time zones against the system catalog even when the caller has a same-named temporary table', async () => {
  const v = await asAdmin(fixtures);
  await asAdmin(async () => {
    await db.exec("create temporary table pg_timezone_names(name text); insert into pg_temp.pg_timezone_names values ('Europe/Imaginary');");
    try {
      await expect(change('create', null, { ...createInput(v), timezone: 'Europe/Imaginary' })).rejects.toMatchObject({ code: '22023' });
      expect(await change('create', null, createInput(v))).toMatchObject({ timezone: 'Asia/Shanghai' });
    } finally { await db.exec('drop table pg_temp.pg_timezone_names'); }
  });
});

it('rolls back an existing task update when the audit insert fails', async () => {
  const task = await asAdmin(async () => change('create', null, createInput(await fixtures())));
  const request = randomUUID();
  await db.exec("create function public.test_reject_audit() returns trigger language plpgsql as $$ begin raise exception 'injected audit failure'; end $$;" +
    "create trigger test_reject_audit before insert on distribution_publish_logs for each row when (new.request_id='" + request + "') execute function public.test_reject_audit();");
  try {
    await expect(asAdmin(() => change('start', task, {}, request))).rejects.toMatchObject({ code: 'P0001' });
    expect(await asAdmin(() => read(task.id))).toEqual(task);
    expect((await asAdmin(() => logs(task.id))).rows).toHaveLength(1);
  } finally { await db.exec('drop trigger test_reject_audit on distribution_publish_logs; drop function public.test_reject_audit();'); }
  expect(await asAdmin(() => change('start', task, {}, request))).toMatchObject({ status: 'awaiting_confirmation', version: 2 });
});

it('keeps elapsed plans read-only until a user explicitly starts the workflow', async () => {
  const v = await asAdmin(fixtures);
  const task = await asAdmin(() => change('create', null, { ...createInput(v), scheduled_at: new Date(Date.now() + 1200).toISOString() }));
  await db.query('select pg_sleep(1.3)');
  await asAdmin(async () => {
    expect(Date.parse(task.scheduled_at)).toBeLessThan(Date.now());
    expect(await read(task.id)).toEqual(task);
    expect((await logs(task.id)).rows).toHaveLength(1);
  });
});

it('refuses cleanup for the wrong project or an unrelated event, then removes only the recorded run', async () => {
  const run_id = randomUUID(), marker = 'M3 integration ' + run_id;
  const actor_ids = [admin, secondAdmin];
  await db.query('update auth.users set raw_app_meta_data=$1 where id=any($2::uuid[])', [{ distribution_staging_run_id: run_id }, actor_ids]);
  const fixture = await asAdmin(() => fixtures(image, marker));
  const unrelated = await asAdmin(async () => change('create', null, createInput(await fixtures())));
  const request = randomUUID(), startRequest = randomUUID();
  const task = await asAdmin(() => change('create', null, { ...createInput(fixture), plan_note: marker }, request));
  await asAdmin(() => change('start', task, {}, startRequest));
  const scope = { project_ref: 'uartrtcmskyuqxawjqlx', run_id, actor_ids, source: fixture.post, account: fixture.account,
    variant: fixture.variant, request_ids: [request, startRequest] };
  expect(() => publishRunDatabaseCleanup({ ...scope, project_ref: 'vfgmptjfcfgptaqblydd' })).toThrow('Invalid Staging');
  try {
    await expect(db.exec(publishRunDatabaseCleanup({ ...scope, request_ids: [request] }))).rejects.toThrow('outside the run manifest');
  } finally { await db.exec('rollback'); }
  expect((await asAdmin(() => logs(task.id))).rows).toHaveLength(2);
  await db.exec(publishRunDatabaseCleanup(scope));
  expect((await db.query('select id from distribution_publish_tasks where id=$1', [task.id])).rows).toEqual([]);
  expect((await db.query('select media_id from distribution_publish_task_media where task_id=$1', [task.id])).rows).toEqual([]);
  expect((await asAdmin(() => logs(task.id))).rows).toEqual([]);
  expect(await asAdmin(() => read(unrelated.id))).toEqual(unrelated);
});

it('rehearses the rollback-only Staging audit failure probe', async () => {
  const run = randomUUID(), marker = 'M3 integration ' + run;
  await db.query('update auth.users set raw_app_meta_data=$1 where id=$2', [{ distribution_staging_run_id: run }, admin]);
  const task = await asAdmin(async () => change('create', null, { ...createInput(await fixtures(image, marker)), plan_note: marker }));
  const sql = readFileSync('supabase/tests/distribution_m3_atomic_rollback.sql', 'utf8')
    .replace("'00000000-0000-0000-0000-000000000000'", "'" + run + "'")
    .replace("'00000000-0000-0000-0000-000000000000'", "'" + task.id + "'")
    .replace("'00000000-0000-0000-0000-000000000000'", "'" + admin + "'")
    .replace('task_revision integer := 0;', 'task_revision integer := ' + task.version + ';');
  const result = await db.exec(sql);
  expect(result.flatMap(part => part.rows)).toContainEqual({
    verification: { passed: true, injected_audit_failure: true, transaction_rolled_back: true },
  });
  expect(await asAdmin(() => read(task.id))).toEqual(task);
  expect((await db.query("select tgname from pg_trigger where tgname='m3_test_reject_audit'")).rows).toEqual([]);
});

it('refuses schema rollback with history and removes only the M3 objects when empty', async () => {
  const sql = readFileSync('supabase/rollbacks/distribution_m3.sql', 'utf8');
  try {
    await expect(db.exec(sql)).rejects.toThrow('preserve M3 task, media and audit history');
  } finally { await db.exec('rollback'); }
  await db.exec('delete from distribution_publish_logs; delete from distribution_publish_task_media; delete from distribution_publish_tasks;');
  await db.exec(sql);
  expect((await db.query("select to_regnamespace('distribution_publish_private') as private_schema, " +
    "to_regclass('public.distribution_publish_tasks') as tasks, " +
    "(select count(*)::integer from pg_roles where rolname='distribution_publish_writer') as writer")).rows)
    .toEqual([{ private_schema: null, tasks: null, writer: 0 }]);
  expect(await oldPolicies()).toEqual(baselinePolicies);
});
