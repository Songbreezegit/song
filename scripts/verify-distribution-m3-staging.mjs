import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { isDeepStrictEqual as same } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import { elevate, recordServiceVersions, signIn } from './verify-distribution-staging.mjs';
import { apiEvidence, check, createStagingTarget, dataOf, isStagingResourceUuid, ProbeError, record } from './lib/distribution-staging-target.mjs';
import { requireMissingStorageObject } from './lib/distribution-staging-checks.mjs';
import { withStagingResources } from './lib/distribution-staging-resources.mjs';
import { runPublishUiChecks } from './lib/distribution-m3-staging-ui.mjs';
import { publishRunDatabaseCleanup } from './lib/distribution-m3-staging-cleanup.mjs';

const auth = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };
const fkError = result => ['23001','23503'].includes(result.error?.code);
const conflict = result => result.status === 409 && result.error?.code === 'PT409';
const imageLink = (media_id, notes = '') => ({ media_id, is_cover: true, aspect_ratio_hint: '3:4', processing_notes: notes });
const privateTables = ['distribution_publish_tasks', 'distribution_publish_task_media', 'distribution_publish_logs'];

function failure(error, fallback) {
  if (error instanceof ProbeError) record(error.status, error.message, { severity: error.severity, ...error.evidence });
  else record('FAIL', fallback, { error_type: error?.name });
}

async function run() {
  const runId = randomUUID();
  const target = createStagingTarget(process.env.DISTRIBUTION_STAGING_PROJECT_REF,
    process.env.DISTRIBUTION_STAGING_API_URL, process.env.DISTRIBUTION_STAGING_MANAGEMENT_TOKEN);
  delete process.env.DISTRIBUTION_STAGING_MANAGEMENT_TOKEN;
  const project = await target.verifyProject();
  record('PASS', 'Staging project identity confirmed', { project_ref: target.ref, run_id: runId, postgres: project.database?.version });
  const publicKey = await target.publishableKey();
  const input = createInterface({ input: process.stdin, terminal: false });
  const lines = input[Symbol.asyncIterator]();
  const stop = new AbortController();
  const interrupt = () => { stop.abort(); input.close(); };
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', interrupt);
  const sdk = (key = publicKey) => createClient(target.origin, key, { global: { fetch: target.fetchStaging }, auth });
  const api = token => createClient(target.origin, publicKey, { global: { fetch: target.fetchStaging }, accessToken: async () => token });
  const checkpoint = async (step, evidence = {}) => {
    record('NEXT', step, { project_ref: target.ref, run_id: runId, ...evidence });
    const answer = await lines.next();
    if (answer.done || answer.value.trim() !== step) throw new ProbeError('BLOCKED', 'Missing verified Staging checkpoint: ' + step);
  };
  try {
    await checkpoint('migration-verified', { migration: 'add_distribution_publish_calendar' });
    await withStagingResources({ target, runId, makeAuthAdmin: key => sdk(key).auth.admin, signal: stop.signal }, async createUser => {
      async function createPerson(role) {
        const password = 'Aa1!' + randomBytes(24).toString('base64url');
        const user = await createUser('distribution-m3-' + role + '-' + runId + '@example.invalid', password);
        return { ...user, password };
      }
      const admin = await createPerson('admin'), second = await createPerson('second-admin'), member = await createPerson('member');
      await checkpoint('admins-registered', { admins: [admin.id, second.id], member_id: member.id });
      const adminAuth = sdk(), secondAuth = sdk(), memberAuth = sdk();
      const aal1 = await signIn(adminAuth, admin, target.origin, 'M3 admin aal1');
      await signIn(secondAuth, second, target.origin, 'M3 second admin aal1');
      await signIn(memberAuth, member, target.origin, 'M3 member aal1');
      const verified = await elevate(adminAuth, admin, target.origin, 'M3 admin aal2', runId);
      const verifiedSecond = await elevate(secondAuth, second, target.origin, 'M3 second admin aal2', runId);
      const verifiedMember = await elevate(memberAuth, member, target.origin, 'M3 member aal2', runId);
      const client = api(verified.token), secondClient = api(verifiedSecond.token);
      const memberMembership = dataOf(await api(verifiedMember.token).from('admin_users').select('user_id').eq('user_id', member.id),
        'Verify the run member has no administrative membership');
      check(memberMembership.length === 0, 'Ordinary aal2 user is separate from the admin fixtures');
      const negativeActors = [{ client: sdk(), label: 'anon', anonymous: true }, { client: api(aal1), label: 'admin aal1' },
        { client: api(verifiedMember.token), label: 'member aal2' }];
      await recordServiceVersions(target, publicKey, verified.token);
      await probe({
        target, runId, client, secondClient, negativeActors, admin: { ...admin, nextCode: verified.nextCode },
        second, publicKey, checkpoint, signal: stop.signal,
      });
    });
  } finally {
    input.close();
    process.off('SIGINT', interrupt);
    process.off('SIGTERM', interrupt);
  }
}

async function probe({ target, runId, client, secondClient, negativeActors, admin, second, publicKey, checkpoint, signal }) {
  const source = randomUUID(), account = randomUUID(), variant = randomUUID();
  const marker = 'M3 integration ' + runId;
  const folder = 'uploads/distribution-m3-' + runId;
  const requests = new Set();
  const attemptedMedia = new Map();
  const bucket = client.storage.from('media');
  const bytes = await readFile(new URL('../public/assets/work/work-project-cover-fuji.webp', import.meta.url));
  const scope = { project_ref: target.ref, run_id: runId, source, account, variant, actor_ids: [admin.id, second.id] };
  record('NEXT', 'M3 scoped data manifest', { ...scope, folder, marker });
  const trackRequest = id => {
    check(isStagingResourceUuid(id), 'Run request ID is a UUID', {}, 'P1');
    if (!requests.has(id)) {
      requests.add(id);
      record('NEXT', 'M3 request reserved', { project_ref: target.ref, run_id: runId, request_id: id });
    }
  };
  function command(action, task, payload = {}, actor = client, id = randomUUID()) {
    signal.throwIfAborted();
    trackRequest(id);
    return actor.rpc('change_distribution_publish_task', {
      p_request_id: id, p_action: action, p_task_id: task?.id ?? null, p_version: task?.version ?? null, p_input: payload,
    });
  }
  const change = async (...args) => dataOf(await command(...args), 'M3 transition ' + args[0]);
  const getTask = async id => dataOf(await client.from('distribution_publish_tasks').select('*').eq('id', id).single(), 'Read exact M3 task');
  const events = async id => dataOf(await client.from('distribution_publish_logs').select('event_type,actor_id,request_id,old_state,new_state,metadata')
    .eq('task_id', id).order('task_version'), 'Read exact M3 task timeline');
  async function findObject(name) {
    const rows = dataOf(await bucket.list(folder, { search: name, limit: 10 }), 'List exact run Storage path');
    const matches = rows.filter(row => row.name === name && isStagingResourceUuid(row.id));
    check(matches.length <= 1, 'At most one object matches the run path', {}, 'P1');
    return matches[0];
  }
  async function upload(name) {
    signal.throwIfAborted();
    check(!await findObject(name), 'Run Storage path is unused', {}, 'P1');
    const path = folder + '/' + name;
    attemptedMedia.set(name, null);
    record('NEXT', 'M3 Storage path reserved', { project_ref: target.ref, run_id: runId, path });
    const uploadResult = await bucket.upload(path, bytes, { contentType: 'image/webp', upsert: false });
    const status = apiEvidence(uploadResult).http;
    if (status >= 400 && status < 500 && status !== 408) attemptedMedia.delete(name);
    const result = dataOf(uploadResult, 'Upload run WebP through real Storage');
    const object = await findObject(name);
    check(object && (!result.id || object.id === result.id), 'Storage UUID and exact run path match');
    attemptedMedia.set(name, object.id);
    record('PASS', 'Run Storage object created', { project_ref: target.ref, run_id: runId, path, id: object.id });
    return object.id;
  }
  async function bytesAt(name) {
    const publicUrl = bucket.getPublicUrl(folder + '/' + name).data.publicUrl;
    const response = await target.fetchStaging(publicUrl + '?m3-check=' + randomUUID(), { cache: 'no-store' });
    check(response.ok, 'Read actual Storage bytes', { http: response.status }, 'P1');
    return Buffer.from(await response.arrayBuffer());
  }
  const startDate = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
  const schedule = (time = '12:00') => ({ scheduled_at: startDate + 'T' + time + ':00Z', timezone: 'UTC', plan_note: marker });
  const plan = (version, time) => ({ ...schedule(time), variant_id: variant, variant_version: version });
  let runError;
  let cleanupError;
  try {
    for (const actor of [{ client, id: admin.id }, { client: secondClient, id: second.id }]) {
      const rows = dataOf(await actor.client.from('admin_users').select('user_id').eq('user_id', actor.id), 'Verify run admin membership');
      check(rows.length === 1, 'Only the scoped administrator is used');
    }
    dataOf(await client.from('distribution_publish_tasks').select('id', { head: true }).eq('id', randomUUID()), 'Verify M3 Data API');
    dataOf(await client.from('distribution_accounts').insert({ id: account, platform: 'other', name: marker + ' account', notes: marker }), 'Create exact M3 run account');
    const original = await upload('frozen.webp'), newer = await upload('replacement.webp');
    const fields = { title: marker + ' source', body: 'Run-scoped publishing text', tags: ['M3'], content_type: 'image_text' };
    dataOf(await client.rpc('save_distribution_post', { p_id: source, p_version: null, p_post: {
      ...fields, project_id: null, promotion_goal: 'awareness', status: 'draft',
    }, p_account_ids: [account], p_media_ids: [] }), 'Create M1 content source with a target account');
    const draft = dataOf(await client.rpc('create_distribution_variant', { p_id: variant, p_post_id: source, p_account_id: account }), 'Create M2 draft');
    const saveVariant = async (version, title, image, note) => dataOf(await client.rpc('save_distribution_variant', {
      p_id: variant, p_version: version, p_variant: { ...fields, title, status: 'ready' }, p_media: [imageLink(image, note)],
    }), 'Save independent ready M2 draft');
    const ready = await saveVariant(draft.version, marker + ' v1', original, '保留原封面');
    check(ready.id === variant && ready.status === 'ready', 'M1 source and M2 ready draft available');

    const createRequest = randomUUID();
    const createPlan = plan(ready.version);
    const creationRace = await Promise.all([
      command('create', null, createPlan, client, createRequest), command('create', null, createPlan, client, createRequest),
    ]);
    const task = dataOf(creationRace[0], 'First concurrent creation response');
    check(same(task, dataOf(creationRace[1], 'Replay concurrent creation response')) && (await events(task.id)).length === 1,
      'Concurrent duplicate creation returns exactly one task and audit event', {}, 'P1');
    const repeat = await change('create', null, plan(ready.version, '13:00'));
    check(repeat.id !== task.id && repeat.content_snapshot.variant_id === task.variant_id, 'One variant supports multiple independent tasks');
    record('PASS', 'Real concurrent request replay and repeat scheduling', { task_ids: [task.id, repeat.id] });

    for (const actor of negativeActors) {
      for (const table of privateTables) {
        const column = table === 'distribution_publish_tasks' ? 'id' : 'task_id';
        const result = await actor.client.from(table).select(column).eq(column, task.id);
        check(actor.anonymous ? result.status === 401 && result.error?.code === '42501' :
          result.status === 200 && result.data?.length === 0, actor.label + ' cannot read ' + table, apiEvidence(result), 'P1');
      }
      const result = await command('start', task, {}, actor.client);
      check(result.status === (actor.anonymous ? 401 : 403) && result.error?.code === '42501',
        actor.label + ' cannot execute M3 transition', apiEvidence(result), 'P1');
      record('PASS', 'Real M3 permission denial for ' + actor.label, apiEvidence(result));
    }
    const direct = [
      () => client.from(privateTables[0]).update({ status: 'manually_reported' }).eq('id', task.id),
      () => client.from(privateTables[0]).update({ content_snapshot: {} }).eq('id', task.id),
      () => client.from(privateTables[2]).insert({ task_id: task.id, event_type: 'task_started' }),
      () => client.from(privateTables[2]).update({ metadata: {} }).eq('task_id', task.id),
      () => client.from(privateTables[2]).delete().eq('task_id', task.id),
    ];
    for (const dml of direct) {
      const result = await dml();
      check(result.status === 403 && result.error?.code === '42501', 'Admin aal2 direct task/audit DML rejected', apiEvidence(result), 'P1');
    }
    check(same(await getTask(task.id), task) && (await events(task.id)).length === 1, 'Unauthorized DML did not modify task or history', {}, 'P1');
    record('PASS', 'Authenticated direct REST task/audit bypass denied');

    const schedules = await Promise.all([
      command('reschedule', task, schedule('14:00')),
      command('reschedule', task, schedule('15:00'), secondClient),
    ]);
    const winners = schedules.filter(result => !result.error), losers = schedules.filter(conflict);
    check(winners.length === 1 && losers.length === 1 && (await events(task.id)).length === 2, 'Two actual admin sessions produce one update and one PT409', {}, 'P1');
    const moved = winners[0].data;
    const invalid = await command('reschedule', moved, { scheduled_at: moved.scheduled_at, timezone: 'UTC', plan_note: 'x'.repeat(2001) });
    check(invalid.error?.code === '22023' && same(await getTask(task.id), moved) && (await events(task.id)).length === 2,
      'Invalid transition leaves exact task and audit state intact', apiEvidence(invalid), 'P1');
    record('PASS', 'Real version conflict and rejected transition preserve task and history');

    const revised = await saveVariant(ready.version, marker + ' v2', newer, '新版处理说明');
    check((await getTask(task.id)).content_snapshot.media[0].media_id === original
      && (await getTask(task.id)).title === ready.title, 'Updating M2 does not change the frozen M3 task');
    const updated = await change('refresh_snapshot', moved, { variant_version: revised.version });
    check(updated.content_snapshot.media[0].media_id === newer && updated.title === revised.title && (await getTask(repeat.id)).title === ready.title,
      'Explicit snapshot update affects only the selected task');
    const attemptedDelete = await bucket.remove([folder + '/frozen.webp']);
    check(attemptedDelete.error?.code === 'ResourceReferenced' && (await findObject('frozen.webp'))?.id === original
      && (await bytesAt('frozen.webp')).equals(bytes), 'Real Storage blocks task-only reference deletion and retains bytes', apiEvidence(attemptedDelete), 'P1');
    const deleteSource = await client.from('distribution_posts').delete().eq('id', source).eq('status', 'draft').select('id');
    check(fkError(deleteSource) && (await getTask(task.id)).id === task.id, 'Source delete cannot erase task history', apiEvidence(deleteSource), 'P1');
    record('PASS', 'Frozen revisions, explicit adoption, historical Storage and source deletion boundaries');

    await checkpoint('atomic-probe', { task_id: updated.id, task_version: updated.version, actor_id: admin.id });
    const started = await change('start', updated);
    const report = { published_at: new Date(Date.now() - 60_000).toISOString(), external_url: 'https://example.com/m3/' + runId,
      report_note: marker, account_id: account, variant_version: started.variant_version };
    const wrongUrl = await command('report', started, { ...report, external_url: 'javascript:alert(1)' });
    check(wrongUrl.error?.code === '22023' && (await getTask(task.id)).status === 'awaiting_confirmation', 'Unsafe work URL does not advance state');
    const reportId = randomUUID();
    const reported = await change('report', started, report, client, reportId);
    check(reported.status === 'manually_reported' && reported.report_evidence === 'manual_user_report' && reported.reported_by === admin.id
      && same(await change('report', started, report, client, reportId), reported), 'Real report records explicit evidence and exact replay');
    const corrected = await change('correct_report', reported, { ...report, reason: marker, report_note: 'Corrected run evidence' });
    const timeline = await events(task.id);
    check(timeline.map(event => event.event_type).join(',') ===
      'task_created,task_rescheduled,task_snapshot_updated,task_started,manual_reported,manual_report_corrected'
      && same(timeline.at(-1).old_state, reported) && same(timeline.at(-1).new_state, corrected), 'Original report and correction remain auditable');
    const cancelled = await change('cancel', repeat, { reason: marker });
    check(cancelled.status === 'cancelled' && (await command('start', cancelled)).error?.code === '22023', 'Cancelled plans remain terminal');
    record('PASS', 'Manual evidence, exact report replay, correction and cancellation', { task_id: task.id, events: timeline.length });

    await runPublishUiChecks(target, publicKey, admin, {
      source, variantId: variant, variantVersion: revised.version, title: revised.title, date: startDate, accountId: account, marker, trackRequest,
    });
    const archive = await client.from('distribution_accounts').update({ archived_at: new Date().toISOString() }).eq('id', account).select('is_enabled,archived_at').single();
    const archived = dataOf(archive, 'Archive run account');
    check(!archived.is_enabled && archived.archived_at && (await getTask(task.id)).status === 'manually_reported'
      && conflict(await command('create', null, plan(revised.version))), 'Archived account preserves history and rejects new schedules');
    record('PASS', 'Archived accounts retain history and cannot create tasks');
  } catch (error) {
    runError = error;
    failure(error, 'Unexpected M3 integration failure');
  } finally {
    try {
      await checkpoint('database-clean', { ...scope, request_ids: [...requests], cleanup_sql: publishRunDatabaseCleanup({ ...scope, request_ids: [...requests] }) });
      for (const [table, column, id] of [['distribution_posts','id',source], ['distribution_variants','id',variant],
        ['distribution_publish_tasks','variant_id',variant], ['distribution_accounts','id',account]]) {
        const rows = dataOf(await client.from(table).select('id').eq(column, id), 'Verify scoped database cleanup for ' + table);
        check(rows.length === 0, 'Run rows must be absent in ' + table, {}, 'P1');
      }
      record('PASS', 'M3 run database rows removed by verified UUID and run marker');
    } catch (error) {
      cleanupError = error;
      failure(error, 'M3 run database cleanup incomplete');
    }
    for (const [name, knownId] of attemptedMedia) {
      const path = folder + '/' + name;
      try {
        const existing = await findObject(name);
        if (existing) {
          check((!knownId || existing.id === knownId) && (await bytesAt(name)).equals(bytes), 'Storage cleanup requires scoped path, UUID and run bytes', {}, 'P1');
          const removed = dataOf(await bucket.remove([path]), 'Delete exact run file through Storage API after references are removed');
          check(removed.length === 1 && !await findObject(name), 'Run file is absent after Storage delete', {}, 'P1');
        }
        const response = await target.fetchStaging(bucket.getPublicUrl(path).data.publicUrl + '?m3-clean=' + randomUUID(), { cache: 'no-store' });
        const evidence = await requireMissingStorageObject(response, 'Public run file cannot be read after cleanup');
        record('PASS', 'Run Storage cleanup confirmed', { project_ref: target.ref, run_id: runId, path, object_id: knownId, ...evidence });
      } catch (error) {
        cleanupError ??= error;
        failure(error, 'M3 Storage cleanup incomplete');
        record('NEXT', 'Inspect exact run Storage object before scoped recovery', { project_ref: target.ref, run_id: runId, path, object_id: knownId });
      }
    }
  }
  if (cleanupError) throw new ProbeError('FAIL', 'M3 data cleanup needs operator verification', scope);
  if (runError) throw runError;
}

run().catch(error => {
  failure(error, 'Unexpected M3 Staging runner failure');
  process.exitCode = error instanceof ProbeError && error.status === 'BLOCKED' ? 2 : 1;
});
