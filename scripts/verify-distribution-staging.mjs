import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline';
import { setTimeout as delay } from 'node:timers/promises';
import { createClient } from '@supabase/supabase-js';
import { check, createStagingTarget, dataOf, ProbeError, record } from './lib/distribution-staging-target.mjs';
import { removeImage, runDistributionApiChecks, uploadImage } from './lib/distribution-staging-checks.mjs';

const adminEmail = 'distribution-review@example.invalid';
const memberEmail = 'distribution-member@example.invalid';
const authOptions = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };
const period = 30_000;

function totp(secret, time) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const seed = Buffer.alloc(Math.floor(secret.length * 5 / 8));
  let available = 0;
  let word = 0;
  let index = 0;
  for (const char of secret.toUpperCase().replace(/=+$/, '')) {
    const value = alphabet.indexOf(char);
    check(value >= 0, 'GoTrue issued a valid Base32 TOTP secret');
    word = (word << 5) | value;
    available += 5;
    if (available >= 8) {
      available -= 8;
      seed[index++] = (word >> available) & 255;
    }
  }
  check(index > 0, 'GoTrue issued a nonempty TOTP secret');
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(time / period)));
  const digest = createHmac('sha1', seed.subarray(0, index)).update(counter).digest();
  const offset = digest.at(-1) & 15;
  const code = String((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0');
  seed.fill(0);
  digest.fill(0);
  return code;
}

function newCodeGenerator(secret) {
  let lastStep = -1;
  return async () => {
    let time = Date.now();
    if (Math.floor(time / period) === lastStep || period - (time % period) < 4000) {
      await delay(period - (time % period) + 500);
      time = Date.now();
    }
    lastStep = Math.floor(time / period);
    return totp(secret, time);
  };
}

async function expectIdentity(sdk, token, person, aal, origin, label) {
  const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
  const { user } = dataOf(await sdk.auth.getUser(token), `${label} GoTrue getUser`);
  const levels = dataOf(await sdk.auth.mfa.getAuthenticatorAssuranceLevel(token), `${label} assurance level`);
  check(user?.id === person.id && user.email === person.email && claims.sub === person.id
    && claims.email === person.email && claims.role === 'authenticated' && claims.iss === `${origin}/auth/v1`
    && claims.aal === aal && levels.currentLevel === aal, `${label} signed identity and assurance`, {}, 'P1');
  if (aal === 'aal2') {
    check(Array.isArray(claims.amr) && claims.amr.some(method => method.method === 'totp'), `${label} signed TOTP proof`, {}, 'P1');
  }
}

async function checkMembership(client, person, expected) {
  const rows = dataOf(await client.from('admin_users').select('user_id').eq('user_id', person.id), 'Verify Staging admin membership');
  check(expected ? rows.length === 1 && rows[0].user_id === person.id : rows.length === 0, 'Temporary user has only its intended membership', {}, 'P1');
}

async function signIn(sdk, person, origin, label) {
  const { session } = dataOf(await sdk.auth.signInWithPassword({ email: person.email, password: person.password }), `${label} password login`);
  check(session?.access_token, `${label} GoTrue issued a session`);
  await expectIdentity(sdk, session.access_token, person, 'aal1', origin, label);
  return session.access_token;
}

async function elevate(sdk, person, origin, label, runId) {
  const factor = dataOf(await sdk.auth.mfa.enroll({ factorType: 'totp', friendlyName: `m1-${runId}` }), `${label} TOTP enrollment`);
  const nextCode = newCodeGenerator(factor.totp.secret);
  const session = dataOf(await sdk.auth.mfa.challengeAndVerify({ factorId: factor.id, code: await nextCode() }), `${label} TOTP challenge and verify`);
  await expectIdentity(sdk, session.access_token, person, 'aal2', origin, label);
  record('PASS', 'GoTrue password aal1, TOTP enrollment, challenge and signed aal2', { actor: label });
  return { token: session.access_token, nextCode };
}

async function recordServiceVersions(target, publicKey, accessToken) {
  for (const [service, path] of [['GoTrue', '/auth/v1/health'], ['PostgREST', '/rest/v1/'], ['Storage', '/storage/v1/version']]) {
    try {
      const response = await target.fetchStaging(`${target.origin}${path}`, {
        headers: { apikey: publicKey, Authorization: `Bearer ${accessToken}` },
      });
      const content = response.ok ? (await response.text()).trim() : '';
      const data = /^[{"]/.test(content) ? JSON.parse(content) : content;
      const version = typeof data === 'string' ? data : data?.version ?? data?.info?.version;
      if (typeof version === 'string' && /^[A-Za-z0-9_.+-]{1,64}$/.test(version) && /\d/.test(version)) {
        record('PASS', 'Observed Staging service version', { service, version, http: response.status });
      } else {
        record('BLOCKED', 'Service version was not exposed by this endpoint', { service, http: response.status });
      }
    } catch {
      record('BLOCKED', 'Service version request unavailable', { service });
    }
  }
}

async function main() {
  // RFC 6238 Appendix B uses the same SHA-1 truncation. This is the six-digit
  // suffix of its published eight-digit result at 59 seconds.
  check(totp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 59_000) === '287082', 'RFC 6238 SHA-1 reference vector');
  const target = createStagingTarget(process.env.DISTRIBUTION_STAGING_PROJECT_REF,
    process.env.DISTRIBUTION_STAGING_API_URL, process.env.DISTRIBUTION_STAGING_MANAGEMENT_TOKEN);
  delete process.env.DISTRIBUTION_STAGING_MANAGEMENT_TOKEN;
  const project = await target.verifyProject();
  record('PASS', 'Management API revalidated Staging target', {
    ref: target.ref, region: project.region, project_status: project.status, database_release: project.database?.version,
  });
  const runId = randomUUID();
  const keyName = `m1_${runId.replaceAll('-', '').slice(0, 16)}`;
  const publicKey = await target.publishableKey();
  record('NEXT', 'Staging run manifest', { run_id: runId, secret_key_name: keyName });
  const secret = await target.createSecretKey(keyName);
  check(typeof secret.id === 'string' && secret.name === keyName && secret.type === 'secret'
    && /^sb_secret_[\w-]{16,}$/.test(secret.api_key), 'Management API issues this run’s temporary secret key');
  record('PASS', 'Temporary Staging secret key created', { key_id: secret.id });

  const options = { global: { fetch: target.fetchStaging } };
  const userSdk = () => createClient(target.origin, publicKey, { ...options, auth: authOptions });
  const apiSdk = token => createClient(target.origin, publicKey, { ...options, accessToken: async () => token });
  const authAdmin = createClient(target.origin, secret.api_key, { ...options, auth: authOptions }).auth.admin;

  async function createTemporaryUser(email) {
    const password = `Aa1!${randomBytes(24).toString('base64url')}`;
    const { user } = dataOf(await authAdmin.createUser({
      email, password, email_confirm: true, user_metadata: { distribution_staging_run_id: runId },
    }), 'Create and confirm temporary GoTrue user via Staging Auth Admin API');
    check(user?.email === email && user.email_confirmed_at && user.user_metadata?.distribution_staging_run_id === runId,
      'Staging Auth Admin API created the expected confirmed fixture');
    record('PASS', 'Temporary GoTrue user created', { user_id: user.id, fixture: email === adminEmail ? 'admin' : 'member' });
    return { id: user.id, email, password };
  }

  const input = createInterface({ input: process.stdin, terminal: false });
  const lines = input[Symbol.asyncIterator]();
  async function waitFor(operation, info) {
    record('NEXT', operation, info);
    const line = await lines.next();
    if (line.done || line.value.trim() !== operation) throw new ProbeError('BLOCKED', `Waiting for verified Staging SQL checkpoint: ${operation}`);
  }

  try {
    const admin = await createTemporaryUser(adminEmail);
    const member = await createTemporaryUser(memberEmail);
    await waitFor('admin-registered', { run_id: runId, admin_id: admin.id, member_id: member.id });
    const adminAuth = userSdk();
    const memberAuth = userSdk();
    const adminInitial = await signIn(adminAuth, admin, target.origin, 'Admin');
    const memberInitial = await signIn(memberAuth, member, target.origin, 'Non-admin');
    await checkMembership(apiSdk(adminInitial), admin, true);
    await checkMembership(apiSdk(memberInitial), member, false);
    const verifiedAdmin = await elevate(adminAuth, admin, target.origin, 'admin aal2', runId);
    const verifiedMember = await elevate(memberAuth, member, target.origin, 'non-admin aal2', runId);
    const adminAal1 = await signIn(userSdk(), admin, target.origin, 'Independent admin aal1');
    record('PASS', 'Independent real GoTrue admin aal1 session');
    await waitFor('schema-ready', { admin_id: admin.id });

    const client = apiSdk(verifiedAdmin.token);
    const memberClient = apiSdk(verifiedMember.token);
    const adminAal1Client = apiSdk(adminAal1);
    await checkMembership(client, admin, true);
    await checkMembership(adminAal1Client, admin, true);
    await checkMembership(memberClient, member, false);
    await recordServiceVersions(target, publicKey, verifiedAdmin.token);
    const fixture = await runDistributionApiChecks(target, client, [
      { label: 'anon', sdk: userSdk(), anon: true },
      { label: 'non-admin aal2', sdk: memberClient },
      { label: 'admin aal1', sdk: adminAal1Client },
    ], runId);

    const bucket = client.storage.from('media');
    const uiImage = await uploadImage(target, bucket, fixture.folder, 'staging-ui.webp');
    const { runDistributionUiChecks } = await import('./lib/distribution-staging-ui.mjs');
    const ui = await runDistributionUiChecks(target, publicKey, { ...admin, nextCode: verifiedAdmin.nextCode }, fixture.marker, uiImage);
    dataOf(await client.from('distribution_posts').delete().eq('id', ui.postId).eq('title', ui.title).eq('status', 'draft')
      .select('id').single(), 'Delete this run’s UI draft');
    await removeImage(target, bucket, uiImage);
    await waitFor('database-clean', { run_id: runId, marker: fixture.marker, account_ids: [fixture.accountId, ui.accountId] });

    const remainingAccounts = dataOf(await client.from('distribution_accounts').select('id')
      .in('id', [fixture.accountId, ui.accountId]), 'Check removal of this run’s archived account fixtures');
    check(remainingAccounts.length === 0, 'Scoped SQL cleanup removed both archived fixtures');
    for (const person of [member, admin]) {
      const { user } = dataOf(await authAdmin.getUserById(person.id), 'Verify fixture ownership before Auth deletion');
      check(user.id === person.id && user.email === person.email && user.user_metadata?.distribution_staging_run_id === runId,
        'Only this run’s Auth fixtures can be deleted', {}, 'P1');
      dataOf(await authAdmin.deleteUser(person.id), 'Delete temporary user through Staging Auth Admin API');
      const absent = await authAdmin.getUserById(person.id);
      check(absent.error?.status === 404, 'GoTrue confirms temporary user deletion');
    }
    await target.revokeSecretKey(secret.id, keyName);
    record('PASS', 'Scoped Auth fixtures and temporary API key removed', { run_id: runId });
  } finally {
    input.close();
  }
}

main().catch(error => {
  if (error instanceof ProbeError) record(error.status, error.message, { severity: error.severity, ...error.evidence });
  else {
    const unavailable = error.name === 'TimeoutError' || /^(?:UND_ERR_|ECONN|ENET|EHOST|EAI_|ETIMEDOUT|ENOTFOUND)/.test(error.cause?.code);
    record(unavailable ? 'BLOCKED' : 'FAIL', unavailable ? 'Staging network request unavailable' : 'Unexpected runner error',
      { error_type: error.name, severity: unavailable ? undefined : 'P2' });
  }
  process.exitCode = 1;
});
