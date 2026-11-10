import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { isDeepStrictEqual as same } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import { elevate, recordServiceVersions, signIn } from './verify-distribution-staging.mjs';
import { apiEvidence, check, createStagingTarget, dataOf, isStagingResourceUuid, ProbeError, record } from './lib/distribution-staging-target.mjs';
import { withStagingResources } from './lib/distribution-staging-resources.mjs';
import { runVariantUiChecks } from './lib/distribution-m2-staging-ui.mjs';

const authOptions = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };
const link = (media_id, cover = false) => ({ media_id, is_cover: cover, aspect_ratio_hint: '', processing_notes: '' });
const isConflict = result => result.status === 409 && result.error?.code === 'PT409';
const sourceFields = source => ({
  title: source.title, body: source.body, tags: source.tags, content_type: source.content_type, status: 'draft',
  project_id: null, promotion_goal: 'awareness',
});
const variantFields = variant => ({
  title: variant.title, body: variant.body, tags: variant.tags, content_type: variant.content_type, status: 'draft',
});

async function main() {
  const target = createStagingTarget(process.env.DISTRIBUTION_STAGING_PROJECT_REF,
    process.env.DISTRIBUTION_STAGING_API_URL, process.env.DISTRIBUTION_STAGING_MANAGEMENT_TOKEN);
  delete process.env.DISTRIBUTION_STAGING_MANAGEMENT_TOKEN;
  const project = await target.verifyProject();
  record('PASS', 'M2 Staging target verified', { ref: target.ref, region: project.region, database_release: project.database?.version });
  const runId = randomUUID();
  const marker = 'staging-m2 ' + runId;
  const publicKey = await target.publishableKey();
  const input = createInterface({ input: process.stdin, terminal: false });
  const lines = input[Symbol.asyncIterator]();
  const cancellation = new AbortController();
  const { signal } = cancellation;
  const interrupt = () => { cancellation.abort(new ProbeError('BLOCKED', 'M2 Staging verification interrupted')); input.close(); };
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', interrupt);

  const sdk = (key = publicKey) => createClient(target.origin, key, { global: { fetch: target.fetchStaging }, auth: authOptions });
  const api = token => createClient(target.origin, publicKey, { global: { fetch: target.fetchStaging }, accessToken: async () => token });
  const makeAuthAdmin = key => sdk(key).auth.admin;
  const checkpoint = async (step, evidence) => {
    signal.throwIfAborted();
    record('NEXT', step, { ref: target.ref, run_id: runId, ...evidence });
    const response = await lines.next();
    signal.throwIfAborted();
    if (response.done || response.value.trim() !== step) throw new ProbeError('BLOCKED', 'Missing verified Staging checkpoint: ' + step);
  };
  try {
    await withStagingResources({ target, runId, makeAuthAdmin, signal }, async createUser => {
      const createPerson = async role => {
        const password = 'Aa1!' + randomBytes(24).toString('base64url');
        return { ...(await createUser('distribution-m2-' + role + '-' + runId + '@example.invalid', password)), password };
      };
      const admin = await createPerson('admin');
      const member = await createPerson('member');
      await checkpoint('admin-registered', { admin_id: admin.id, admin_email: admin.email, member_id: member.id });
      const adminAuth = sdk(), memberAuth = sdk();
      const adminAal1 = await signIn(adminAuth, admin, target.origin, 'M2 admin aal1');
      await signIn(memberAuth, member, target.origin, 'M2 member aal1');
      const verifiedAdmin = await elevate(adminAuth, admin, target.origin, 'M2 admin aal2', runId);
      const verifiedMember = await elevate(memberAuth, member, target.origin, 'M2 member aal2', runId);
      await recordServiceVersions(target, publicKey, verifiedAdmin.token);
      const client = api(verifiedAdmin.token);
      const adminRow = dataOf(await client.from('admin_users').select('user_id').eq('user_id', admin.id), 'Verify this run’s Staging membership');
      const memberRows = dataOf(await api(verifiedMember.token).from('admin_users').select('user_id').eq('user_id', member.id), 'Verify temporary non-admin');
      check(adminRow.length === 1 && memberRows.length === 0, 'Exact temporary membership and non-admin separation', {}, 'P1');
      dataOf(await client.from('distribution_variants').select('source_retained_fields', { head: true }).eq('id', randomUUID()),
        'Verify the final M2 source review schema is available before writing fixtures');
      await probe(client, { ...admin, nextCode: verifiedAdmin.nextCode }, [
        { label: 'anon', client: sdk(), anonymous: true },
        { label: 'member aal2', client: api(verifiedMember.token) },
        { label: 'admin aal1', client: api(adminAal1) },
      ]);
    });
  } finally {
    input.close();
    process.off('SIGINT', interrupt);
    process.off('SIGTERM', interrupt);
  }

  async function probe(client, admin, actors) {
    const source = randomUUID();
    const accounts = [randomUUID(), randomUUID(), randomUUID()].map((id, index) => ({
      id, platform: 'xiaohongshu', name: marker + ' account ' + (index + 1), notes: marker,
    }));
    const folder = 'uploads/distribution-m2-' + runId;
    const names = ['source.webp', 'variant-only.webp'];
    const sourceTitle = marker + ' source v1';
    const sourceTitleV2 = marker + ' source v2';
    const bucket = client.storage.from('media');
    const attemptedUploads = new Map();
    const markerRow = { source, marker, accounts: accounts.map(({ id, name }) => ({ id, name })), folder, names };
    const mediaBytes = await readFile(new URL('../public/assets/work/work-project-cover-fuji.webp', import.meta.url));
    record('NEXT', 'M2 scoped data manifest', { ref: target.ref, run_id: runId, ...markerRow });

    async function storedObject(name) {
      const rows = dataOf(await bucket.list(folder, { limit: 10, search: name }), 'Read the exact run-scoped Storage object');
      const matching = rows.filter(item => item.name === name && item.id);
      check(matching.length <= 1, 'One Storage object per scoped path', {}, 'P1');
      return matching[0];
    }
    const saveSource = (title, body, version, ids, promotionGoal = 'awareness') => client.rpc('save_distribution_post', {
      p_id: source, p_version: version, p_post: { ...sourceFields({ title, body, tags: ['M2'], content_type: 'image_text' }), promotion_goal: promotionGoal },
      p_account_ids: accounts.map(account => account.id), p_media_ids: ids,
    });
    const create = (actor, account, id) => actor.rpc('create_distribution_variant', { p_id: id, p_post_id: source, p_account_id: account });
    const save = (variant, fields, media) => client.rpc('save_distribution_variant', {
      p_id: variant.id, p_version: variant.version, p_variant: fields, p_media: media,
    });
    const review = (actor, rpc, variant, sourceVersion, fields) => actor.rpc(rpc, {
      p_id: variant.id, p_version: variant.version, p_source_version: sourceVersion, p_fields: fields,
    });
    const getVariant = async id => {
      const row = dataOf(await client.from('distribution_variants').select('id,post_id,account_id,title,body,tags,content_type,status,source_version,source_snapshot,source_retained_fields,version,distribution_variant_media(media_id,sort_order,is_cover,aspect_ratio_hint,processing_notes)')
        .eq('post_id', source).eq('id', id).single(), 'Read the exact saved platform variant');
      return { ...row, distribution_variant_media: row.distribution_variant_media.sort((a, b) => a.sort_order - b.sort_order) };
    };
    let verificationError;
    try {
      dataOf(await client.from('distribution_accounts').insert(accounts), 'Create the three run-scoped target accounts');
      for (const name of names) {
        signal.throwIfAborted();
        check(!await storedObject(name), 'The run-scoped upload path must be unused', {}, 'P1');
        attemptedUploads.set(name, null);
        const upload = await bucket.upload(folder + '/' + name, mediaBytes, { contentType: 'image/webp', upsert: false });
        const rejection = apiEvidence(upload).http;
        if (rejection >= 400 && rejection < 500 && rejection !== 408) attemptedUploads.delete(name);
        dataOf(upload, 'Upload the run-scoped WebP');
        const stored = await storedObject(name);
        check(isStagingResourceUuid(stored?.id), 'Storage returned the run-scoped object UUID');
        attemptedUploads.set(name, stored.id);
      }
      const initial = await storedObject(names[0]), independent = await storedObject(names[1]);
      check(initial?.id === attemptedUploads.get(names[0]) && independent?.id === attemptedUploads.get(names[1]) && initial.id !== independent.id,
        'Storage exposed distinct real object UUIDs');
      record('PASS', 'Run-scoped Storage UUIDs resolved', { ref: target.ref, run_id: runId, media_ids: [initial.id, independent.id] });
      const created = dataOf(await saveSource(sourceTitle, 'source v1', null, [initial.id]), 'Save a real M1 source and three targets');
      const aId = randomUUID(), bId = randomUUID();
      const a = dataOf(await create(client, accounts[0].id, aId), 'Create first account variant');
      const b = dataOf(await create(client, accounts[1].id, bId), 'Create same-platform account variant');
      const retry = dataOf(await create(client, accounts[0].id, aId), 'Replay an identical create request');
      check(a.id === aId && b.id === bId && a.version === 1 && a.platform === b.platform
        && same(a.media, [link(initial.id)]) && same(a, retry), 'Create snapshot, independent account identity and idempotent retry');
      record('PASS', 'Real PostgREST snapshot creation for two accounts on one platform and idempotent retry');

      for (const actor of actors) {
        for (const table of ['distribution_variants', 'distribution_variant_media']) {
          const key = table === 'distribution_variants' ? 'id' : 'variant_id';
          const result = await actor.client.from(table).select(key).eq(key, a.id);
          check(actor.anonymous ? result.error?.code === '42501' : !result.error && result.data.length === 0,
            'Forbidden actor cannot read M2 data', { actor: actor.label, table, ...apiEvidence(result) }, 'P1');
        }
        const result = await create(actor.client, accounts[0].id, aId);
        check(result.error?.code === '42501', 'Forbidden actor cannot invoke M2 create', { actor: actor.label, ...apiEvidence(result) }, 'P1');
        for (const rpc of ['sync_distribution_variant', 'retain_distribution_variant_source']) {
          const denied = await review(actor.client, rpc, a, created.version, ['body']);
          check(denied.error?.code === '42501', 'Forbidden actor cannot review M2 source fields', { actor: actor.label, rpc, ...apiEvidence(denied) }, 'P1');
        }
      }
      record('PASS', 'Real anonymous, non-admin aal2 and admin aal1 access boundaries');

      const saved = dataOf(await save(a, { ...variantFields(a), title: 'A 的独立文案', tags: ['🍃,标签'] }, [link(independent.id, true), link(initial.id)]),
        'Save independent variant title, tags and media order');
      const untouched = await getVariant(b.id);
      check(saved.title === 'A 的独立文案' && saved.version === 2 && untouched.title === sourceTitle
        && untouched.distribution_variant_media[0]?.media_id === initial.id, 'Independent platform drafts have separate revisions and media');

      const editedSource = dataOf(await saveSource(sourceTitleV2, 'source v2', created.version, [initial.id]), 'Edit the canonical source');
      check((await getVariant(a.id)).title === saved.title, 'Source update does not overwrite independent text');
      const staleSource = await review(client, 'sync_distribution_variant', saved, created.version, ['body']);
      check(isConflict(staleSource), 'Stale source revision returns HTTP 409 PT409', apiEvidence(staleSource));
      const partial = dataOf(await review(client, 'sync_distribution_variant', saved, editedSource.version, ['body']),
        'Synchronize the selected body without consuming the title change');
      check(partial.source_version === created.version && partial.title === saved.title && partial.body === 'source v2'
        && partial.source_snapshot.title === sourceTitle && partial.source_snapshot.body === 'source v2'
        && same(partial.media, saved.media), 'Partial review preserves authored title, pending source difference and media');
      const staleVariant = await review(client, 'sync_distribution_variant', saved, editedSource.version, ['title']);
      check(isConflict(staleVariant), 'Stale platform draft revision returns HTTP 409 PT409', apiEvidence(staleVariant));
      const synchronized = dataOf(await review(client, 'sync_distribution_variant', partial, editedSource.version, ['title']),
        'Synchronize the remaining title from the same source revision');
      check(synchronized.source_version === editedSource.version && synchronized.title === sourceTitleV2
        && synchronized.body === partial.body && same(synchronized.media, partial.media), 'Second selection completes the same source revision');
      record('PASS', 'Real partial field sync, later title adoption and both HTTP 409 PT409 boundaries');

      const metadata = dataOf(await saveSource(sourceTitleV2, 'source v2', editedSource.version, [initial.id], 'download'), 'Update only the source promotion goal');
      const confirmed = dataOf(await review(client, 'retain_distribution_variant_source', synchronized, metadata.version, []),
        'Confirm a source revision with identical content fields');
      check(same(confirmed, { ...synchronized, source_version: metadata.version, version: synchronized.version + 1, updated_at: confirmed.updated_at }),
        'Version acknowledgement does not change content, media or status');
      const nextSource = dataOf(await saveSource(sourceTitleV2, 'source v4', metadata.version, [initial.id], 'download'), 'Create a subsequent source change');
      const kept = dataOf(await review(client, 'retain_distribution_variant_source', confirmed, nextSource.version, ['body']),
        'Explicitly retain the saved body after the next source revision');
      check(kept.source_version === nextSource.version && kept.body === confirmed.body && kept.source_snapshot.body === 'source v4'
        && kept.source_retained_fields.body === nextSource.version && same(kept.media, confirmed.media), 'Retained choice persists without overwriting the draft');
      record('PASS', 'Real metadata-only confirmation and explicit keep on a later source revision');

      const race = await Promise.all(['A concurrent 1', 'A concurrent 2'].map(title =>
        save(kept, { ...variantFields(kept), title }, kept.media)));
      check(race.filter(result => !result.error).length === 1
        && race.filter(isConflict).length === 1,
      'Exactly one simultaneous RPC save commits, the other returns HTTP 409 PT409');
      const winner = race.find(result => !result.error).data;
      const before = await getVariant(a.id);
      const bad = await save(winner, { ...variantFields(winner), title: 'Must not persist' }, [link(initial.id), link(randomUUID())]);
      check(bad.error?.code === '23503' && same(await getVariant(a.id), before), 'Invalid media rolls back variant body, revision and relations');
      record('PASS', 'Real PostgREST concurrent PT409 and full RPC rollback');

      const failure = await bucket.remove([folder + '/' + names[1]]);
      check(failure.error && /ResourceReferenced/i.test(String(failure.error.error ?? failure.error.code ?? failure.error.message)),
        'Storage API refuses deletion of a variant-only media object', apiEvidence(failure));
      const retained = await storedObject(names[1]);
      const url = bucket.getPublicUrl(folder + '/' + names[1]).data.publicUrl;
      const response = await target.fetchStaging(url + '?m2-check=' + runId, { cache: 'no-store', headers: { apikey: publicKey } });
      check(response.ok && retained?.id === independent.id && mediaBytes.equals(Buffer.from(await response.arrayBuffer())),
        'Storage metadata and uncached object bytes survive the rejected delete');
      dataOf(await save(winner, variantFields(winner), [link(initial.id)]), 'Unlink the variant-only image');
      dataOf(await bucket.remove([folder + '/' + names[1]]), 'Delete unlinked run-scoped media through the Storage API');
      check(!await storedObject(names[1]), 'Unlinked image is absent from real Storage');
      record('PASS', 'Real Storage RESTRICT preserves bytes until the independent media reference is removed');

      await runVariantUiChecks(target, publicKey, admin, { source, sourceTitle: sourceTitleV2, uiAccount: accounts[2].id, uiAccountName: accounts[2].name });
    } catch (error) {
      verificationError = error;
      recordError(error, 'Unexpected verification error before cleanup');
    }
    let cleanupError;
    try {
      const row = dataOf(await client.from('distribution_posts').select('id,title,status,version').eq('id', source).maybeSingle(), 'Verify run-owned source before cleanup');
      if (row) {
        check(row.id === source && [sourceTitle, sourceTitleV2].includes(row.title) && row.status === 'draft', 'Source cleanup requires exact run ID, title and draft status', {}, 'P1');
        dataOf(await client.from('distribution_posts').delete().eq('id', source).eq('title', row.title).eq('version', row.version)
          .eq('status', 'draft').select('id').single(), 'Delete only this run’s source and cascading variants');
      }
      const variants = dataOf(await client.from('distribution_variants').select('id').eq('post_id', source), 'Check run variants after source cleanup');
      check(variants.length === 0, 'All run variants were removed with the source');
      for (const [name, id] of attemptedUploads) {
        const stored = await storedObject(name);
        if (stored) {
          check(!id || stored.id === id, 'Storage cleanup must match the exact run path and known object UUID', {}, 'P1');
          dataOf(await bucket.remove([folder + '/' + name]), 'Delete this run’s exact Storage path');
        }
        check(!await storedObject(name), 'Run-scoped Storage path is empty after cleanup');
      }
      record('PASS', 'Run-scoped source, variants and Storage paths cleaned', { ref: target.ref, run_id: runId });
    } catch (error) {
      cleanupError = error;
      record('FAIL', 'Run data cleanup needs inspection', { ref: target.ref, run_id: runId, ...markerRow, error_type: error.name });
    }
    try {
      await checkpoint('database-clean', markerRow);
      const remaining = dataOf(await client.from('distribution_accounts').select('id').in('id', accounts.map(account => account.id)), 'Check exact run account UUIDs after cleanup');
      check(remaining.length === 0, 'No run-owned accounts remain after scoped cleanup');
      record('PASS', 'No run-owned accounts remain', { ref: target.ref, run_id: runId });
    } catch (error) {
      cleanupError ??= error;
      recordError(error, 'Unexpected account cleanup error');
    }
    if (cleanupError) throw new ProbeError('FAIL', 'M2 run data cleanup incomplete', { ref: target.ref, run_id: runId });
    if (verificationError) process.exitCode = 1;
  }
}

function recordError(error, fallback) {
  if (error instanceof ProbeError) record(error.status, error.message, { severity: error.severity, ...error.evidence });
  else record('FAIL', fallback, { error_type: error.name });
}

main().catch(error => {
  recordError(error, 'Unexpected M2 runner error');
  process.exitCode = 1;
});
