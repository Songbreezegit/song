import { randomUUID } from 'node:crypto';
import { check, dataOf, isStagingResourceUuid, ProbeError, record, stagingRunKey } from './distribution-staging-target.mjs';

function isRunUser(user, fixture, runId) {
  return user?.id === fixture.id && user.email === fixture.email
    && user.app_metadata?.distribution_staging_run_id === runId;
}

function userNotFound(result) {
  return result.error?.status === 404 && result.error.code === 'user_not_found';
}

export async function withStagingResources({ target, runId, makeAuthAdmin, signal }, run) {
  const key = stagingRunKey(runId);
  const scope = { project_ref: target.ref, run_id: runId };
  const users = [];
  let authAdmin;
  let keyAttempted = false;
  let keyId;
  let result;
  let cleanupErrors = 0;

  async function createUser(email, password) {
    signal?.throwIfAborted();
    const fixture = { id: randomUUID(), email };
    // GoTrue accepts an explicit UUID. Keep it even if the response is lost.
    users.push(fixture);
    record('NEXT', 'Reserved temporary Auth user UUID', { ...scope, user_id: fixture.id });
    const { user } = dataOf(await authAdmin.createUser({
      id: fixture.id, email, password, email_confirm: true,
      app_metadata: { distribution_staging_run_id: runId },
    }), 'Create and confirm temporary GoTrue user via Staging Auth Admin API');
    check(isRunUser(user, fixture, runId) && user.email_confirmed_at, 'GoTrue created this run’s confirmed Auth user');
    return fixture;
  }

  try {
    check(!await target.findSecretKey(runId), 'This run’s Secret API Key marker must be unused', {}, 'P1');
    signal?.throwIfAborted();
    record('NEXT', 'Staging run manifest', { ...scope, secret_key_name: key.name });
    keyAttempted = true;
    const secret = await target.createSecretKey(runId);
    if (secret?.name === key.name && secret.type === key.type && isStagingResourceUuid(secret.id)) keyId = secret.id;
    check(keyId && secret.description === key.description
      && /^sb_secret_[\w-]{16,}$/.test(secret.api_key), 'Management API issues this run’s temporary Secret API Key');
    record('PASS', 'Temporary Staging Secret API Key created', { ...scope, key_id: keyId });
    authAdmin = makeAuthAdmin(secret.api_key);
    signal?.throwIfAborted();
    result = await run(createUser);
  } finally {
    async function cleanup(step, evidence, operation) {
      try {
        await operation();
        record('PASS', step, { ...scope, ...evidence });
      } catch (error) {
        cleanupErrors++;
        record(error instanceof ProbeError ? error.status : 'FAIL', step, {
          ...scope, ...evidence,
          ...(error instanceof ProbeError ? { reason: error.message, ...error.evidence } : { error_type: error?.name }),
        });
      }
    }

    for (const fixture of users) {
      await cleanup('Temporary Auth user absent after cleanup', { user_id: fixture.id }, async () => {
        await target.verifyProject();
        const lookup = await authAdmin.getUserById(fixture.id);
        if (userNotFound(lookup)) return;
        const { user } = dataOf(lookup, 'Read Auth user before cleanup');
        check(isRunUser(user, fixture, runId), 'Cleanup must match the Auth user UUID, email and protected run marker', {}, 'P1');
        const deletion = await authAdmin.deleteUser(fixture.id);
        const after = await authAdmin.getUserById(fixture.id);
        if (userNotFound(after)) return;
        dataOf(deletion, 'Delete this run’s temporary Auth user');
        dataOf(after, 'Verify Auth user deletion');
        check(false, 'GoTrue still returns the temporary Auth user after deletion');
      });
    }
    if (keyAttempted) {
      const evidence = { key_id: keyId, key_name: key.name };
      await cleanup('Temporary Secret API Key absent after cleanup', evidence, async () => {
        // The API assigns the key UUID. Recover it by the complete run marker
        // only when creation could not return the UUID.
        evidence.key_id ??= (await target.findSecretKey(runId))?.id;
        if (evidence.key_id) await target.revokeSecretKey(evidence.key_id, runId);
      });
    }
  }
  if (cleanupErrors) throw new ProbeError('FAIL', 'Staging credential cleanup incomplete', { ...scope, errors: cleanupErrors }, 'P2');
  return result;
}
