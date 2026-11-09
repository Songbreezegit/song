import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { apiEvidence, check, dataOf, ProbeError, record } from './distribution-staging-target.mjs';

const sample = new URL('../../public/assets/work/work-project-cover-fuji.webp', import.meta.url);
const accountColumns = 'id,name,is_enabled,archived_at,version';
const nestedColumns = 'id,title,version,distribution_post_targets(account_id),distribution_post_media(media_id,sort_order)';
const uuidPattern = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;

export function requireDenied(result, step, { anon = false, filter = false } = {}) {
  const { http, code } = apiEvidence(result);
  if (!http || http === 429 || http >= 500) throw new ProbeError('BLOCKED', step, { http, code });
  const rejected = (anon ? [401, 403] : [403]).includes(http) && code === '42501';
  const hidden = filter && !result.error && http === 200 && Array.isArray(result.data) && result.data.length === 0;
  check(rejected || hidden, step, { http, code }, result.error ? 'P2' : 'P1');
  return { step, http, code, ...(hidden ? { rows: 0 } : {}) };
}

export async function findImage(bucket, folder, name) {
  return dataOf(await bucket.list(folder), 'Read Staging Storage object metadata').find(item => item.name === name);
}

export async function uploadImage(target, bucket, folder, name) {
  const path = `${folder}/${name}`;
  const bytes = await readFile(sample);
  dataOf(await bucket.upload(path, bytes, { contentType: 'image/webp', upsert: false }), 'Upload WebP to Staging');
  const item = await findImage(bucket, folder, name);
  check(uuidPattern.test(item?.id ?? ''), 'Storage list returns the new object UUID');
  const image = { id: item.id, path, folder, name, bytes };
  await verifyImageBytes(target, bucket, image, 'Download uploaded WebP');
  return image;
}

async function downloadImage(target, bucket, image) {
  const url = new URL(bucket.getPublicUrl(image.path).data.publicUrl);
  url.searchParams.set('review', randomUUID());
  return target.fetchStaging(url);
}

async function verifyImageBytes(target, bucket, image, step, severity = 'P2') {
  const result = await downloadImage(target, bucket, image);
  check(result.ok, step, { http: result.status }, severity);
  check(Buffer.from(await result.arrayBuffer()).equals(image.bytes), step, { http: result.status }, severity);
  return result.status;
}

export async function removeImage(target, bucket, image) {
  dataOf(await bucket.remove([image.path]), 'Delete unreferenced WebP via Storage API');
  check(!await findImage(bucket, image.folder, image.name), 'Deleted WebP absent from Storage list');
  const response = await downloadImage(target, bucket, image);
  const status = response.status === 400 ? (await response.json()).statusCode : response.status;
  check(String(status) === '404', 'Deleted WebP cannot be downloaded', { http: response.status }, 'P1');
  return response.status;
}

function payload(title) {
  return {
    title, body: 'Temporary Staging M1 fixture', tags: [], content_type: 'image_text',
    project_id: null, promotion_goal: 'awareness', status: 'draft',
  };
}

function save(client, id, version, post, accounts, media) {
  return client.rpc('save_distribution_post', {
    p_id: id, p_version: version, p_post: post, p_account_ids: accounts, p_media_ids: media,
  });
}

async function checkNegativeActor({ label, sdk, anon }, fixture) {
  const { accountId, postId, otherPostId, mediaId, marker } = fixture;
  const probeId = randomUUID();
  record('NEXT', 'Scoped negative probe IDs', { actor: label, probe_id: probeId });
  const surfaces = [
    { table: 'distribution_accounts', key: 'id', value: accountId, insert: { id: probeId, platform: 'other', name: marker }, patch: { name: `${marker} denied` } },
    { table: 'distribution_posts', key: 'id', value: postId, insert: { id: probeId, ...payload(marker) }, patch: { title: `${marker} denied` } },
    { table: 'distribution_post_targets', key: 'post_id', value: postId, insert: { post_id: otherPostId, account_id: accountId }, patch: { account_id: accountId } },
    { table: 'distribution_post_media', key: 'post_id', value: postId, insert: { post_id: otherPostId, media_id: mediaId, sort_order: 0 }, patch: { sort_order: 1 } },
  ];
  const evidence = [];
  for (const { table, key, value, insert, patch } of surfaces) {
    evidence.push(requireDenied(await sdk.from(table).select(key).eq(key, value), `${table} SELECT`, { anon, filter: !anon }));
    evidence.push(requireDenied(await sdk.from(table).insert(insert), `${table} INSERT`, { anon }));
    evidence.push(requireDenied(await sdk.from(table).update(patch).eq(key, value).select(key), `${table} PATCH`, { anon, filter: !anon }));
    evidence.push(requireDenied(await sdk.from(table).delete().eq(key, value).select(key), `${table} DELETE`, { anon, filter: !anon }));
  }
  evidence.push(requireDenied(await save(sdk, probeId, null, payload(marker), [], []), 'save_distribution_post', { anon }));
  record('PASS', 'PostgREST RLS and RPC boundary', { actor: label, requests: evidence });
}

export async function runDistributionApiChecks(target, client, negativeActors, runId) {
  const marker = `staging-m1 ${runId}`;
  const folder = `uploads/distribution-staging-${runId}`;
  const bucket = client.storage.from('media');
  const accountId = randomUUID();
  const postId = randomUUID();
  const otherPostId = randomUUID();
  record('NEXT', 'Scoped API fixture IDs', { run_id: runId, account_id: accountId, post_ids: [postId, otherPostId], folder });
  const image = await uploadImage(target, bucket, folder, 'reference.webp');
  record('PASS', 'Real Storage upload, UUID and download', {
    object_id: image.id, size: image.bytes.length, sha256: createHash('sha256').update(image.bytes).digest('hex'),
  });
  const accounts = () => client.from('distribution_accounts');
  const posts = () => client.from('distribution_posts');
  const account = dataOf(await accounts().insert({ id: accountId, platform: 'other', name: marker })
    .select(accountColumns).single(), 'Admin aal2 creates account');
  check(account.id === accountId && account.is_enabled && account.archived_at === null, 'New account is active');

  const original = payload(`${marker} source`);
  const source = dataOf(await save(client, postId, null, original, [accountId], [image.id]), 'Admin aal2 saves linked source');
  const other = payload(`${marker} secondary`);
  const secondary = dataOf(await save(client, otherPostId, null, other, [], []), 'Admin aal2 saves secondary draft');
  const readSource = async () => dataOf(await posts().select(nestedColumns).eq('id', postId).single(), 'Read nested source');
  const snapshot = await readSource();
  check(snapshot.version === source.version
    && isDeepStrictEqual(snapshot.distribution_post_targets, [{ account_id: accountId }])
    && isDeepStrictEqual(snapshot.distribution_post_media, [{ media_id: image.id, sort_order: 0 }]), 'PostgREST resolves both embedded links');
  const initial = dataOf(await accounts().select(accountColumns).eq('id', accountId).single(), 'Read active account');
  check(isDeepStrictEqual(initial, account), 'Admin aal2 reads account');
  record('PASS', 'Admin aal2 reads and writes sources, accounts and embedded links');

  for (const actor of negativeActors) await checkNegativeActor(actor, { accountId, postId, otherPostId, mediaId: image.id, marker });
  check(isDeepStrictEqual(await readSource(), snapshot), 'Negative API probes leave existing source untouched', {}, 'P1');
  const accountAfterNegative = dataOf(await accounts().select(accountColumns).eq('id', accountId).single(), 'Read account after negative probes');
  check(isDeepStrictEqual(accountAfterNegative, account), 'Negative API probes leave existing account untouched', {}, 'P1');

  const edited = dataOf(await accounts().update({ name: `${marker} edited` }).eq('id', accountId)
    .select(accountColumns).single(), 'Admin aal2 updates active account');
  check(edited.version === account.version + 1 && edited.name === `${marker} edited`, 'Authorized account PATCH updates name and version');
  const deniedDelete = requireDenied(await accounts().delete().eq('id', accountId).select('id'), 'Admin aal2 account DELETE');

  const targetLinks = () => client.from('distribution_post_targets');
  const mediaLinks = () => client.from('distribution_post_media');
  dataOf(await targetLinks().insert({ post_id: otherPostId, account_id: accountId }).select('post_id').single(), 'Admin aal2 inserts target link');
  dataOf(await mediaLinks().insert({ post_id: otherPostId, media_id: image.id, sort_order: 0 }).select('post_id').single(), 'Admin aal2 inserts media link');
  const order = dataOf(await mediaLinks().update({ sort_order: 1 }).eq('post_id', otherPostId).eq('media_id', image.id)
    .select('sort_order').single(), 'Admin aal2 changes media order');
  check(order.sort_order === 1, 'Direct media PATCH applied');
  dataOf(await targetLinks().delete().eq('post_id', otherPostId).eq('account_id', accountId).select('post_id').single(), 'Admin aal2 removes target link');
  dataOf(await mediaLinks().delete().eq('post_id', otherPostId).eq('media_id', image.id).select('post_id').single(), 'Admin aal2 removes media link');
  record('PASS', 'Admin aal2 direct account and association permissions', { account_delete: deniedDelete });

  const changed = { ...original, title: `${marker} updated source` };
  const updated = dataOf(await save(client, postId, source.version, changed, [accountId], [image.id]), 'Update source at current version');
  check(updated.version === source.version + 1, 'Successful RPC advances version');
  const beforeFailure = await readSource();
  const conflict = await save(client, postId, source.version, original, [], []);
  check(conflict.error?.code === '40001', 'Stale version returns a conflict', apiEvidence(conflict), 'P1');
  check(isDeepStrictEqual(await readSource(), beforeFailure), 'Version conflict leaves current row and links untouched', {}, 'P1');
  const rollback = await save(client, postId, updated.version, original, [], [randomUUID()]);
  check(rollback.error?.code === '23503', 'Invalid media association rejected', apiEvidence(rollback));
  check(isDeepStrictEqual(await readSource(), beforeFailure), 'Invalid association rolls back source, version and both links', {}, 'P1');
  record('PASS', 'Version conflict and atomic association rollback', { stale: apiEvidence(conflict), invalid: apiEvidence(rollback) });

  const callerTimestamp = '2000-01-01T00:00:00.000Z';
  const archived = dataOf(await accounts().update({ archived_at: callerTimestamp, is_enabled: true })
    .eq('id', accountId).select(accountColumns).single(), 'Archive via real PostgREST PATCH');
  check(archived.is_enabled === false && Date.parse(archived.archived_at) > Date.parse(callerTimestamp), 'Archive forces disabled and stores server time');
  const archiveErrors = [];
  for (const change of [{ is_enabled: true }, { archived_at: null }, { archived_at: null, is_enabled: true }, { name: marker }]) {
    const result = await accounts().update(change).eq('id', accountId);
    check(result.error?.code === '55000', 'Archived account rejects restore or edit', apiEvidence(result), 'P1');
    archiveErrors.push(apiEvidence(result));
  }
  const retained = dataOf(await accounts().select(accountColumns).eq('id', accountId).single(), 'Read archived account');
  check(isDeepStrictEqual(retained, archived) && isDeepStrictEqual(await readSource(), beforeFailure), 'Archive preserves record and historical targets');
  const newArchiveTarget = await save(client, otherPostId, secondary.version, other, [accountId], []);
  check(newArchiveTarget.error?.code === '23503', 'An archived account cannot be newly linked', apiEvidence(newArchiveTarget));
  record('PASS', 'Archive PATCH and historical account association', { rejected: archiveErrors, new_target: apiEvidence(newArchiveTarget) });

  const blockedRemove = await bucket.remove([image.path]);
  check(blockedRemove.error, 'Storage rejects removal while media is linked', apiEvidence(blockedRemove), 'P1');
  check((await findImage(bucket, folder, image.name))?.id === image.id, 'Rejected deletion retains Storage metadata UUID', {}, 'P1');
  const retainedDownload = await verifyImageBytes(target, bucket, image, 'Rejected deletion preserves all file bytes', 'P1');
  const detached = dataOf(await save(client, postId, updated.version, changed, [accountId], []), 'Detach media through the RPC');
  check(isDeepStrictEqual(detached.account_ids, [accountId]) && detached.media_ids.length === 0, 'Detach retains historical account target');
  const missingDownload = await removeImage(target, bucket, image);
  const remaining = dataOf(await mediaLinks().select('post_id').eq('media_id', image.id), 'Check no references to deleted Storage object');
  check(remaining.length === 0, 'No dangling distribution media association', {}, 'P1');
  record('PASS', 'Storage reference deletion boundary and byte consistency', {
    linked_remove: apiEvidence(blockedRemove), linked_download: retainedDownload, removed_download: missingDownload, remaining_links: remaining.length,
  });
  for (const [id, title] of [[postId, changed.title], [otherPostId, other.title]]) {
    dataOf(await posts().delete().eq('id', id).eq('title', title).eq('status', 'draft').select('id').single(), 'Delete this run’s API draft');
  }
  record('PASS', 'Admin aal2 deletes its own test drafts');
  return { accountId, folder, marker };
}
