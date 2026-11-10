import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const origin = process.env.DISTRIBUTION_LOCAL_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const endpoint = URL.canParse(origin) ? new URL(origin) : null;
assert.ok(
  endpoint?.protocol === 'http:' && endpoint.hostname === '127.0.0.1' && endpoint.port
    && !endpoint.username && !endpoint.password && endpoint.pathname === '/' && !endpoint.search && !endpoint.hash,
  'Use a disposable Supabase instance on http://127.0.0.1:<port>.',
);

function jwtClaims(value) {
  try {
    return JSON.parse(Buffer.from(value?.split('.')[1] ?? '', 'base64url').toString());
  } catch {
    return null;
  }
}

const anonKey = process.env.DISTRIBUTION_LOCAL_ANON_KEY;
assert.ok(anonKey?.startsWith('sb_publishable_') || jwtClaims(anonKey)?.role === 'anon', 'Provide the local publishable or anon key.');

function localFetch(input, options) {
  const url = new URL(input instanceof Request ? input.url : input);
  assert.ok(url.origin === endpoint.origin, 'Supabase requests must stay on the isolated endpoint.');
  return fetch(input, { ...options, redirect: 'error' });
}

const sdkOptions = { global: { fetch: localFetch } };
const anonymous = createClient(endpoint.origin, anonKey, {
  ...sdkOptions, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const adminEmail = 'distribution-review@example.invalid';

function readSession(variable, aal, email) {
  const token = process.env[variable];
  const claims = jwtClaims(token);
  assert.ok(claims?.role === 'authenticated' && claims.aal === aal && typeof claims.sub === 'string',
    `${variable} must contain a temporary authenticated ${aal} token.`);
  const sdk = createClient(endpoint.origin, anonKey, { ...sdkOptions, accessToken: async () => token });
  return { sdk, token, userId: claims.sub, email };
}

const admin = readSession('DISTRIBUTION_LOCAL_AAL2_TOKEN', 'aal2', adminEmail);
const preMfa = readSession('DISTRIBUTION_LOCAL_AAL1_TOKEN', 'aal1', adminEmail);
const member = readSession('DISTRIBUTION_LOCAL_NON_ADMIN_AAL2_TOKEN', 'aal2', 'distribution-member@example.invalid');
assert.equal(preMfa.userId, admin.userId, 'The two admin sessions must belong to the same temporary account.');
assert.notEqual(member.userId, admin.userId, 'Use a distinct temporary user for the non-admin probe.');

const client = admin.sdk;
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

const identities = [
  { label: 'non-admin aal2', session: member, isAdmin: false },
  { label: 'admin aal1', session: preMfa, isAdmin: true },
  { label: 'admin aal2', session: admin, isAdmin: true },
];
for (const { label, session, isAdmin } of identities) {
  const { data, error } = await anonymous.auth.getUser(session.token);
  assert.ok(!error && data.user?.id === session.userId && data.user.email === session.email,
    `${label}: GoTrue must accept the JWT for the expected temporary account.`);
  const membership = await checked(session.sdk.from('admin_users').select('user_id').eq('user_id', session.userId),
    `${label}: read own admin membership`);
  assert.deepEqual(membership, isAdmin ? [{ user_id: session.userId }] : []);
  console.log(`${label}: GoTrue session and admin membership checked.`);
}

await checked(bucket.upload(path, bytes, { contentType: 'image/webp', upsert: false }), 'Upload fixture');
const media = await readStorageMetadata();
assert.match(media?.id ?? '', /^[0-9a-f-]{36}$/i, 'Storage list must return an object UUID.');
const accounts = () => client.from('distribution_accounts');
const accountColumns = 'id,name,is_enabled,archived_at,version';
const account = await checked(accounts().insert({ id: accountId, platform: 'other', name: `Local review ${accountId}` })
  .select(accountColumns).single(), 'Create enabled account');
assert.ok(account.is_enabled && account.archived_at === null, 'The test account must start active.');
const post = {
  title: 'Local Storage review', body: 'Storage fixture', tags: [],
  content_type: 'image_text', promotion_goal: 'awareness', project_id: null, status: 'draft',
};
const savePost = (version, mediaIds) => client.rpc('save_distribution_post', {
  p_id: postId, p_version: version, p_post: post, p_account_ids: [accountId], p_media_ids: mediaIds,
});
const source = await checked(savePost(null, [media.id]), 'Save source with real target and media');

function expectPermissionDenied(result, label, isAnonymous) {
  const statuses = isAnonymous ? [401, 403] : [403];
  assert.ok(statuses.includes(result.status) && result.error?.code === '42501',
    `${label}: expected insufficient privilege, got HTTP ${result.status} / ${result.error?.code ?? 'no SQLSTATE'}.`);
  assert.equal(result.data, null, label);
}

for (const { label, sdk, isAnonymous } of [
  { label: 'anon', sdk: anonymous, isAnonymous: true },
  { label: 'non-admin aal2', sdk: member.sdk, isAnonymous: false },
  { label: 'admin aal1', sdk: preMfa.sdk, isAnonymous: false },
]) {
  const hiddenRows = [
    ['read account', sdk.from('distribution_accounts').select('id').eq('id', accountId)],
    ['read source', sdk.from('distribution_posts').select('id').eq('id', postId)],
    ['read targets', sdk.from('distribution_post_targets').select('post_id').eq('post_id', postId)],
    ['read media links', sdk.from('distribution_post_media').select('post_id').eq('post_id', postId)],
    ['patch account', sdk.from('distribution_accounts').update({ name: 'Unexpected write' }).eq('id', accountId).select('id')],
    ['delete draft', sdk.from('distribution_posts').delete().eq('id', postId).select('id')],
  ];
  for (const [operation, request] of hiddenRows) {
    const step = `${label}: ${operation}`;
    if (isAnonymous) expectPermissionDenied(await request, step, true);
    else assert.deepEqual(await checked(request, step), [], step);
  }

  const probeId = randomUUID();
  const insert = await sdk.from('distribution_accounts').insert({ id: probeId, name: 'Denied probe', platform: 'other' }).select('id');
  expectPermissionDenied(insert, `${label}: insert account`, isAnonymous);
  const rpc = await sdk.rpc('save_distribution_post', {
    p_id: probeId, p_version: null, p_post: post, p_account_ids: [], p_media_ids: [],
  });
  expectPermissionDenied(rpc, `${label}: save RPC`, isAnonymous);
  console.log(`${label}: protected reads and direct mutations denied.`);
}

assert.deepEqual(await checked(accounts().select(accountColumns).eq('id', accountId).single(), 'Read active fixture'), account);
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
