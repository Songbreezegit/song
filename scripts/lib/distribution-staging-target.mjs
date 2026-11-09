const projectRef = 'uartrtcmskyuqxawjqlx';
const protectedRefs = new Set(['vfgmptjfcfgptaqblydd', 'ttbjtymyuoqkuntcqgob']);
const organizationId = 'hzrxoowmgbfkxtechkoz';
const managementOrigin = 'https://api.supabase.com';
const readMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

export class ProbeError extends Error {
  constructor(status, step, evidence = {}, severity = undefined) {
    super(step);
    this.status = status;
    this.evidence = evidence;
    this.severity = severity;
  }
}

export function record(status, step, evidence = {}) {
  console.log(JSON.stringify({ status, step, ...evidence }));
}

export function check(condition, step, evidence, severity = 'P2') {
  if (!condition) throw new ProbeError('FAIL', step, evidence, severity);
}

export function apiEvidence(result) {
  const code = result.error?.code ?? result.error?.error;
  return {
    http: Number(result.status ?? result.error?.status ?? result.error?.statusCode) || undefined,
    code: typeof code === 'string' && /^[\w.-]{1,64}$/.test(code) ? code : undefined,
  };
}

export function dataOf(result, step) {
  if (result.error) {
    const evidence = apiEvidence(result);
    const unavailable = !evidence.http || evidence.http === 429 || evidence.http >= 500;
    throw new ProbeError(unavailable ? 'BLOCKED' : 'FAIL', step, evidence, unavailable ? undefined : 'P2');
  }
  return result.data;
}

export function createStagingTarget(ref, origin, token) {
  if (protectedRefs.has(ref) || ref !== projectRef || origin !== `https://${ref}.supabase.co`) {
    throw new ProbeError('BLOCKED', 'Staging ref or canonical HTTPS origin rejected', {}, 'P1');
  }
  if (!token?.startsWith('sbp_fc')) {
    throw new ProbeError('BLOCKED', 'A Staging-scoped Management API PAT is required');
  }

  const root = `${managementOrigin}/v1/projects/${ref}`;
  async function management(path = '', method = 'GET', body) {
    const response = await fetch(`${root}${path}`, {
      method,
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    }).catch(() => { throw new ProbeError('BLOCKED', 'Management API connection failed'); });
    if (!response.ok) throw new ProbeError('BLOCKED', 'Management API request rejected', { method, endpoint: path || 'project', http: response.status });
    const content = await response.text();
    return content ? JSON.parse(content) : null;
  }

  async function verifyProject() {
    const project = await management();
    if ((project?.ref ?? project?.id) !== ref || project.organization_id !== organizationId
      || project.name !== 'song-staging' || project.region !== 'ap-northeast-1'
      || project.status !== 'ACTIVE_HEALTHY') {
      throw new ProbeError('BLOCKED', 'Management API could not confirm the approved healthy Staging project', {}, 'P1');
    }
    return project;
  }

  async function guardRequest(url, method) {
    const parsed = new URL(url);
    if (parsed.origin !== origin || parsed.username || parsed.password) {
      throw new ProbeError('BLOCKED', 'Cross-origin API request rejected', {}, 'P1');
    }
    if (!readMethods.has(method.toUpperCase())) await verifyProject();
  }

  async function fetchStaging(input, init) {
    const request = input instanceof Request ? input : null;
    await guardRequest(request?.url ?? input, init?.method ?? request?.method ?? 'GET');
    const timeout = AbortSignal.timeout(25000);
    const signal = init?.signal ?? request?.signal;
    return fetch(input, { ...init, redirect: 'error', signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
  }

  async function publishableKey() {
    const keys = await management('/api-keys?reveal=false');
    const key = keys.find(entry => entry.type === 'publishable' && /^sb_publishable_[\w-]{16,}$/.test(entry.api_key) && !entry.disabled);
    if (!key) throw new ProbeError('BLOCKED', 'Staging publishable key unavailable');
    return key.api_key;
  }

  async function createSecretKey(name) {
    await verifyProject();
    const entry = await management('/api-keys?reveal=true', 'POST', {
      name, type: 'secret', description: 'Temporary M1 integration probe',
    });
    return entry;
  }

  async function revokeSecretKey(id, name) {
    await verifyProject();
    const keys = await management('/api-keys?reveal=false');
    const entry = keys.find(key => key.id === id && key.name === name && key.type === 'secret');
    check(entry, 'Cleanup must match the key created by this run');
    await verifyProject();
    await management(`/api-keys/${encodeURIComponent(id)}?reveal=false`, 'DELETE');
    const remaining = await management('/api-keys?reveal=false');
    check(!remaining.some(key => key.id === id), 'Temporary Staging API key revoked');
  }

  return { ref, origin, verifyProject, guardRequest, fetchStaging, publishableKey, createSecretKey, revokeSecretKey };
}
