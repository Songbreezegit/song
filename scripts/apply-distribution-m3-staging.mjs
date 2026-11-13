import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { createStagingTarget, ProbeError, record } from './lib/distribution-staging-target.mjs';

const ref = 'uartrtcmskyuqxawjqlx';
const name = 'add_distribution_publish_calendar';
const reviewed = 'df5fc7b35224d420381c1d90d6697e6c61989298';
const file = 'supabase/migrations/20261112190304_add_distribution_publish_calendar.sql';
const sha256 = 'c9aa94c8a63df0fb8e521bf77c5bbb9bb71755bbf496224ea8f30dc12e260396';
const endpoint = 'https://api.supabase.com/v1/projects/' + ref + '/database/migrations';
const baseline = new Map([
  ['20261109123623', 'initial_schema'],
  ['20261109123854', 'fix_backend_v1'],
  ['20261109152820', 'enforce_admin_mfa'],
  ['20261109152838', 'add_private_analytics'],
  ['20261109153506', 'add_private_distribution_m1'],
  ['20261109161000', 'report_distribution_version_conflicts'],
  ['20261110174923', 'add_distribution_platform_variants'],
  ['20261110175856', 'review_distribution_source_fields'],
]);
const m2Hashes = new Map([
  ['20261110174923', '48ba065036b71438dddcb548fb8f733e2475b9e09da80e197873799179c69174'],
  ['20261110175856', 'acc63a2cf5d088da312353a8adc652dc5b01119518433a3fb2db8f6ffb081d21'],
]);
const cache = new URL('../node_modules/.cache/', import.meta.url);
const attempt = new URL('song-staging-m3-migration-attempt.json', cache);
const hash = content => createHash('sha256').update(content).digest('hex');

async function apply() {
  if (process.argv.length !== 3 || process.argv[2] !== '--execute-approved-sql') {
    throw new ProbeError('BLOCKED', 'Use only after explicit approval of the Staging Management API submission');
  }
  const token = process.env.DISTRIBUTION_STAGING_MANAGEMENT_TOKEN;
  delete process.env.DISTRIBUTION_STAGING_MANAGEMENT_TOKEN;
  const target = createStagingTarget(ref, 'https://' + ref + '.supabase.co', token);
  const bytes = execFileSync('git', ['show', reviewed + ':' + file], { stdio: ['ignore', 'pipe', 'ignore'] });
  const query = bytes.toString('utf8');
  if (hash(bytes) !== sha256 || !Buffer.from(query, 'utf8').equals(bytes)) {
    throw new ProbeError('BLOCKED', 'Reviewed migration bytes or SHA-256 mismatch');
  }

  const headers = { Authorization: 'Bearer ' + token, Accept: 'application/json' };
  async function read(path = '') {
    const response = await fetch(endpoint + path, {
      method: 'GET', headers, redirect: 'error', signal: AbortSignal.timeout(15000),
    }).catch(() => { throw new ProbeError('BLOCKED', 'Migration history GET transport failed', { path }); });
    if (!response.ok) throw new ProbeError('BLOCKED', 'Migration history GET rejected', { path, http: response.status });
    return response.json();
  }

  function history(rows, size) {
    if (!Array.isArray(rows) || rows.length !== size || rows.some(row => !/^\d{14}$/.test(row?.version ?? '')
      || typeof row.name !== 'string') || new Set(rows.map(row => row.version)).size !== size
      || [...baseline].some(([version, expectedName]) => !rows.some(row => row.version === version && row.name === expectedName))) {
      throw new ProbeError('BLOCKED', 'Staging migration history differs from the reviewed baseline', { expected_rows: size });
    }
    return rows;
  }

  async function verifyDetail(version, expectedName, expectedHash) {
    const detail = await read('/' + version);
    if (detail?.version !== version || detail.name !== expectedName || !Array.isArray(detail.statements) || detail.statements.length !== 1
      || typeof detail.statements[0] !== 'string' || hash(detail.statements[0]) !== expectedHash) {
      throw new ProbeError('BLOCKED', 'Stored migration SQL differs from the reviewed file', { version });
    }
  }

  await target.verifyProject();
  history(await read(), baseline.size);
  for (const [version, expectedHash] of m2Hashes) await verifyDetail(version, baseline.get(version), expectedHash);

  await mkdir(cache, { recursive: true });
  try {
    await writeFile(attempt, JSON.stringify({ project_ref: ref, name, reviewed, sha256, at: new Date().toISOString() }), { flag: 'wx' });
  } catch (error) {
    if (error.code === 'EEXIST') throw new ProbeError('BLOCKED', 'A submission attempt is already recorded. Inspect Staging before taking any further action.');
    throw error;
  }

  const response = await fetch(endpoint, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(90000),
    headers: { ...headers, 'Content-Type': 'application/json', 'Idempotency-Key': 'song-staging-m3-' + sha256 },
    body: JSON.stringify({ name, query }),
  }).catch(() => { throw new ProbeError('BLOCKED', 'Migration POST outcome is unknown. Verify history and objects before any further action.'); });
  if (!response.ok) {
    const status = response.status >= 500 ? 'BLOCKED' : 'FAIL';
    throw new ProbeError(status, 'Migration POST returned an error. Verify history and objects.', { http: response.status });
  }

  const after = history(await read(), baseline.size + 1);
  const added = after.find(row => !baseline.has(row.version));
  if (added.name !== name) throw new ProbeError('BLOCKED', 'The new migration record has an unexpected name');
  await verifyDetail(added.version, name, sha256);
  record('PASS', 'Management API migration receipt and stored SQL', { project_ref: ref, name, version: added.version, sha256, http: response.status });
}

apply().catch(error => {
  if (error instanceof ProbeError) record(error.status, error.message, error.evidence);
  else record('BLOCKED', 'Migration script stopped. Inspect history and objects before any further action.', { error_type: error?.name });
  process.exitCode = 1;
});
