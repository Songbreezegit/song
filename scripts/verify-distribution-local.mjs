import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const origin = process.env.DISTRIBUTION_LOCAL_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const endpoint = new URL(origin);
assert.ok(
  endpoint.protocol === 'http:' && endpoint.hostname === '127.0.0.1' && endpoint.port
    && !endpoint.username && !endpoint.password && endpoint.pathname === '/' && !endpoint.search && !endpoint.hash,
  'Use a disposable Supabase instance on http://127.0.0.1:<port>.',
);
const anonKey = process.env.DISTRIBUTION_LOCAL_ANON_KEY;
const token = process.env.DISTRIBUTION_LOCAL_AAL2_TOKEN;
assert.ok(anonKey && token, 'Provide the local publishable/anon key and an authenticated local aal2 access token.');
const claims = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString());
assert.equal(claims.role, 'authenticated');
assert.equal(claims.aal, 'aal2');

const localFetch = (url, options) => fetch(url, { ...options, redirect: 'error' });
const client = createClient(endpoint.origin, anonKey, { accessToken: async () => token, global: { fetch: localFetch } });
const bucket = client.storage.from('media');
const accountId = randomUUID();
const postId = randomUUID();
const folder = `uploads/distribution-review-${postId}`;
const fileName = 'cover.webp';
const path = `${folder}/${fileName}`;
const bytes = await readFile(new URL('../public/assets/work/work-project-cover-fuji.webp', import.meta.url));

async function checked(request, step) {
  const { data, error } = await request;
  if (error) throw new Error(`${step}: ${error.code ?? error.status ?? ''} ${error.message}`);
  return data;
}

async function readStorageMetadata() {
  const objects = await checked(bucket.list(folder), 'List Storage objects');
  return objects.find(object => object.name === fileName);
}

function fetchObject() {
  const url = new URL(bucket.getPublicUrl(path).data.publicUrl);
  url.searchParams.set('review', randomUUID());
  return localFetch(url);
}

await checked(bucket.upload(path, bytes, { contentType: 'image/webp', upsert: false }), 'Upload fixture');
const media = await readStorageMetadata();
assert.match(media?.id ?? '', /^[0-9a-f-]{36}$/i, 'Storage list must return an object UUID.');
const accounts = () => client.from('distribution_accounts');
await checked(accounts().insert({ id: accountId, platform: 'other', name: `Local review ${accountId}` }), 'Create enabled account');
const post = {
  title: 'Local Storage review', body: 'Storage fixture', tags: [],
  content_type: 'image_text', promotion_goal: 'awareness', project_id: null, status: 'draft',
};
const savePost = (version, mediaIds) => client.rpc('save_distribution_post', {
  p_id: postId, p_version: version, p_post: post, p_account_ids: [accountId], p_media_ids: mediaIds,
});
const source = await checked(savePost(null, [media.id]), 'Save source with real target and media');

const accountColumns = 'id,name,is_enabled,archived_at,version';
const callerTimestamp = '2000-01-01T00:00:00.000Z';
const archived = await checked(accounts().update({ archived_at: callerTimestamp, is_enabled: true })
  .eq('id', accountId).select(accountColumns).single(), 'Archive an enabled account by direct PATCH');
assert.equal(archived.is_enabled, false);
assert.ok(Date.parse(archived.archived_at) > Date.parse(callerTimestamp), 'The server must set the archive timestamp.');
for (const change of [{ archived_at: null, is_enabled: true }, { name: 'Unexpected edit' }]) {
  const { error } = await accounts().update(change).eq('id', accountId);
  assert.equal(error?.code, '55000', 'Direct PATCH must reject restoring or editing the archived account.');
}
assert.deepEqual(await checked(accounts().select(accountColumns).eq('id', accountId).single(), 'Read archived account'), archived);
const relations = await checked(client.from('distribution_posts')
  .select('distribution_post_targets(account_id),distribution_post_media(media_id)').eq('id', postId).single(),
  'Read embedded relations through PostgREST');
assert.deepEqual(relations.distribution_post_targets, [{ account_id: accountId }]);
assert.deepEqual(relations.distribution_post_media, [{ media_id: media.id }]);
console.log('Archive PATCH protection and PostgREST relations passed.');

const linkedRemoval = await bucket.remove([path]);
assert.ok(linkedRemoval.error, 'Storage API must reject deleting a referenced object.');
assert.equal((await readStorageMetadata())?.id, media.id, 'Rejected removal must preserve object metadata.');
const download = await fetchObject();
assert.ok(download.ok, `Object download after rejected removal returned ${download.status}.`);
assert.deepEqual(Buffer.from(await download.arrayBuffer()), bytes, 'Rejected removal must preserve the exact object bytes.');
console.log('Referenced Storage object retained its UUID and bytes.');

const detached = await checked(savePost(source.version, []), 'Detach media through the source RPC');
assert.deepEqual(detached.account_ids, [accountId]);
assert.deepEqual(detached.media_ids, []);
await checked(bucket.remove([path]), 'Remove unreferenced object via Storage API');
assert.equal(await readStorageMetadata(), undefined, 'Removed object metadata must be absent.');
const missing = await fetchObject();
const statusCode = missing.status === 400 ? (await missing.json()).statusCode : missing.status;
assert.equal(String(statusCode), '404', 'A fresh download of the removed object must return not found.');
await checked(client.from('distribution_posts').delete().eq('id', postId).eq('version', detached.version)
  .select('id').single(), 'Delete local fixture draft');
console.log('Unreferenced Storage object removed. Discard the local instance to clear the archived fixture.');
