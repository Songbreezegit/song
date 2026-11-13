import { afterEach, describe, expect, it, vi } from 'vitest';
import { withStagingResources } from '../scripts/lib/distribution-staging-resources.mjs';
import { createStagingTarget, stagingRunKey } from '../scripts/lib/distribution-staging-target.mjs';

const ref = 'uartrtcmskyuqxawjqlx';
const origin = `https://${ref}.supabase.co`;
const runId = 'aaaaaaaa-1234-4000-8000-111111111111';
const otherRunId = 'aaaaaaaa-1234-4000-8000-222222222222';
const keyId = 'bbbbbbbb-1234-4000-8000-111111111111';
const otherKeyId = 'bbbbbbbb-1234-4000-8000-222222222222';
const otherUserId = 'cccccccc-1234-4000-8000-222222222222';
const notFound = { data: null, error: { status: 404, code: 'user_not_found' } };
const firstEmail = 'distribution-review@example.invalid';
const secondEmail = 'distribution-member@example.invalid';
const password = 'test-only-password';

type User = {
  id: string;
  email: string;
  email_confirmed_at: string;
  app_metadata: { distribution_staging_run_id: string };
};

function setup() {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  const project = { ref, organization_id: 'hzrxoowmgbfkxtechkoz', name: 'song-staging', region: 'ap-northeast-1', status: 'ACTIVE_HEALTHY' };
  const switches = { loseKeyResponse: false, loseUserResponse: false, loseDeleteResponse: false, omitSecret: false,
    rejectUserDeletion: false, rateLimitKeyDelete: false };
  const otherKey = { ...stagingRunKey(otherRunId), id: otherKeyId };
  const otherUser = {
    id: otherUserId, email: 'existing@example.invalid', email_confirmed_at: 'confirmed',
    app_metadata: { distribution_staging_run_id: otherRunId },
  };
  const keys = new Map([[otherKeyId, otherKey]]);
  const users = new Map<string, User>([[otherUserId, otherUser]]);
  const deletions: string[] = [];
  const createdUsers: string[] = [];
  const keyRoot = `/v1/projects/${ref}`;

  vi.stubGlobal('fetch', vi.fn(async (input: string, init: RequestInit) => {
    const url = new URL(input);
    expect(url.origin).toBe('https://api.supabase.com');
    if (url.pathname === keyRoot && init.method === 'GET') return Response.json(project);
    if (url.pathname === `${keyRoot}/api-keys`) {
      if (init.method === 'GET') return Response.json([...keys.values()]);
      if (init.method === 'POST') {
        const identity = JSON.parse(String(init.body));
        expect(identity).toEqual(stagingRunKey(runId));
        const key = { ...identity, id: keyId };
        keys.set(key.id, key);
        if (switches.loseKeyResponse) throw new Error('Key creation response lost');
        return Response.json({ ...key, api_key: switches.omitSecret ? undefined : 'sb_secret_test_fixture_only' });
      }
    }
    if (url.pathname === `${keyRoot}/api-keys/${keyId}` && init.method === 'DELETE') {
      if (switches.rateLimitKeyDelete) {
        switches.rateLimitKeyDelete = false;
        return new Response(null, { status: 429, headers: { 'retry-after': '2' } });
      }
      deletions.push(keyId);
      keys.delete(keyId);
      if (switches.loseDeleteResponse) throw new Error('Key delete response lost');
      return new Response(null, { status: 204 });
    }
    throw new Error(`Unexpected management route: ${url.pathname}`);
  }));

  const authAdmin = {
    async createUser(attributes: Omit<User, 'email_confirmed_at'>) {
      if ([...users.values()].some(user => user.email === attributes.email)) {
        return { data: null, error: { status: 422, code: 'email_exists' } };
      }
      const { id, email, app_metadata } = attributes;
      const user = { id, email, app_metadata, email_confirmed_at: 'confirmed' };
      users.set(id, user);
      createdUsers.push(id);
      if (switches.loseUserResponse) throw new Error('User creation response lost');
      return { data: { user }, error: null };
    },
    async getUserById(id: string) {
      return users.has(id) ? { data: { user: users.get(id) }, error: null } : notFound;
    },
    async deleteUser(id: string) {
      if (switches.rejectUserDeletion) return { data: null, error: { status: 409, code: 'user_delete_failed' } };
      deletions.push(id);
      users.delete(id);
      if (switches.loseDeleteResponse) throw new Error('User delete response lost');
      return { data: {}, error: null };
    },
  };
  const options = { target: createStagingTarget(ref, origin, 'sbp_fc_test_fixture_only'), runId, makeAuthAdmin: () => authAdmin };
  return { project, switches, keys, users, deletions, createdUsers, options, otherUser, otherKey };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Staging credential cleanup', () => {
  it('cleans both Auth users before revoking the exact run key after success', async () => {
    const s = setup();
    const result = await withStagingResources(s.options, async createUser => {
      await createUser(firstEmail, password);
      await createUser(secondEmail, password);
      return 'complete';
    });
    expect(result).toBe('complete');
    expect(s.deletions).toEqual([...s.createdUsers, keyId]);
    expect([...s.users.values()]).toEqual([s.otherUser]);
    expect([...s.keys.values()]).toEqual([s.otherKey]);
  });

  it('verifies committed credential deletes after transport failures without deleting again', async () => {
    const s = setup();
    s.switches.loseDeleteResponse = true;
    await withStagingResources(s.options, async createUser => {
      await createUser(firstEmail, password);
    });
    expect(s.deletions).toEqual([...s.createdUsers, keyId]);
    expect([...s.users.values()]).toEqual([s.otherUser]);
    expect([...s.keys.values()]).toEqual([s.otherKey]);
  });

  it('honors a rate limit before retrying cleanup of the exact run key', async () => {
    const s = setup();
    s.switches.rateLimitKeyDelete = true;
    vi.useFakeTimers();
    const result = withStagingResources(s.options, async () => 'complete');
    await vi.advanceTimersByTimeAsync(2000);
    expect(s.switches.rateLimitKeyDelete).toBe(false);
    expect(s.deletions).toEqual([]);
    expect(s.keys.has(keyId)).toBe(true);
    await vi.advanceTimersByTimeAsync(1000);
    await expect(result).resolves.toBe('complete');
    expect(s.deletions).toEqual([keyId]);
    expect([...s.keys.values()]).toEqual([s.otherKey]);
  });

  it('cleans the first user and key after a later checkpoint fails and preserves the error', async () => {
    const s = setup();
    const error = new Error('SQL checkpoint failed');
    await expect(withStagingResources(s.options, async createUser => {
      await createUser(firstEmail, password);
      throw error;
    })).rejects.toBe(error);
    expect(s.deletions).toEqual([...s.createdUsers, keyId]);
    expect([...s.users.keys()]).toEqual([otherUserId]);
  });

  it('recovers a key UUID by full run marker if the creation response is lost', async () => {
    const s = setup();
    s.switches.loseKeyResponse = true;
    await expect(withStagingResources(s.options, vi.fn())).rejects.toThrow('Management API connection failed');
    expect(s.deletions).toEqual([keyId]);
    expect([...s.keys.values()]).toEqual([s.otherKey]);
  });

  it('leaves a pre-existing key with the complete run marker untouched', async () => {
    const s = setup();
    const existing = { ...stagingRunKey(runId), id: keyId };
    s.keys.set(keyId, existing);
    const run = vi.fn();
    await expect(withStagingResources(s.options, run)).rejects.toThrow('must be unused');
    expect(run).not.toHaveBeenCalled();
    expect(s.deletions).toEqual([]);
    expect(s.keys.get(keyId)).toEqual(existing);
  });

  it('revokes a created key even if its secret was not returned', async () => {
    const s = setup();
    s.switches.omitSecret = true;
    await expect(withStagingResources(s.options, vi.fn())).rejects.toThrow('temporary Secret API Key');
    expect(s.deletions).toEqual([keyId]);
    expect([...s.keys.keys()]).toEqual([otherKeyId]);
  });

  it('uses the reserved UUID to clean a second user whose creation response was lost', async () => {
    const s = setup();
    await expect(withStagingResources(s.options, async createUser => {
      await createUser(firstEmail, password);
      s.switches.loseUserResponse = true;
      await createUser(secondEmail, password);
    })).rejects.toThrow('User creation response lost');
    expect(s.createdUsers).toHaveLength(2);
    expect(s.deletions).toEqual([...s.createdUsers, keyId]);
    expect([...s.users.keys()]).toEqual([otherUserId]);
  });

  it('never deletes a prior account with the same email as a failed creation', async () => {
    const s = setup();
    await expect(withStagingResources(s.options, async createUser => {
      await createUser(s.otherUser.email, password);
    })).rejects.toThrow('Create and confirm temporary GoTrue user');
    expect(s.deletions).toEqual([keyId]);
    expect(s.users.get(otherUserId)).toEqual(s.otherUser);
  });

  it('refuses a user whose run marker changed and still revokes the owned key', async () => {
    const s = setup();
    await expect(withStagingResources(s.options, async createUser => {
      const user = await createUser(firstEmail, password);
      s.users.get(user.id)!.app_metadata.distribution_staging_run_id = otherRunId;
    })).rejects.toThrow('Staging credential cleanup incomplete');
    expect(s.deletions).toEqual([keyId]);
    expect(s.users.has(s.createdUsers[0])).toBe(true);
  });

  it('refuses to revoke a key whose run marker changed even when its UUID matches', async () => {
    const s = setup();
    await expect(withStagingResources(s.options, async createUser => {
      await createUser(firstEmail, password);
      s.keys.get(keyId)!.description = s.otherKey.description;
    })).rejects.toThrow('Staging credential cleanup incomplete');
    expect(s.deletions).toEqual(s.createdUsers);
    expect(s.keys.has(keyId)).toBe(true);
  });

  it('does not delete credentials when Management API no longer confirms the target', async () => {
    const s = setup();
    await expect(withStagingResources(s.options, async createUser => {
      await createUser(firstEmail, password);
      s.project.ref = 'vfgmptjfcfgptaqblydd';
    })).rejects.toThrow('Staging credential cleanup incomplete');
    expect(s.deletions).toEqual([]);
    expect(s.keys.has(keyId)).toBe(true);
  });

  it('still revokes the verified key when Auth refuses deletion and preserves the original failure', async () => {
    const s = setup();
    const error = new Error('Storage probe stopped');
    await expect(withStagingResources(s.options, async createUser => {
      await createUser(firstEmail, password);
      s.switches.rejectUserDeletion = true;
      throw error;
    })).rejects.toBe(error);
    expect(s.deletions).toEqual([keyId]);
    expect(s.users.has(s.createdUsers[0])).toBe(true);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('user_delete_failed'));
  });

  it('uses an independent cleanup path when the verification signal aborts', async () => {
    const s = setup();
    const cancellation = new AbortController();
    const error = new Error('Interrupted');
    await expect(withStagingResources({ ...s.options, signal: cancellation.signal }, async createUser => {
      await createUser(firstEmail, password);
      cancellation.abort(error);
      await createUser(secondEmail, password);
    })).rejects.toBe(error);
    expect(s.createdUsers).toHaveLength(1);
    expect(s.deletions).toEqual([...s.createdUsers, keyId]);
  });
});
