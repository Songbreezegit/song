import { createHash, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { apiEvidence, check, dataOf, isStagingResourceUuid, record } from './distribution-staging-target.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const guardMessage = 'Media is retained by a distribution publish task';

export async function inspectPublishRunObject(database, runId, name) {
  check(isStagingResourceUuid(runId) && /^[a-z][a-z0-9-]*\.webp$/.test(name), 'Invalid Staging object identity', {}, 'P1');
  const path = 'uploads/distribution-m3-' + runId + '/' + name;
  const rows = await database.read(`select id, bucket_id, name, owner_id, version, metadata, user_metadata, archived_at, is_delete_marker
    from storage.objects where bucket_id='media' and name='${path}' order by archived_at nulls first;`);
  check(rows.length <= 1, 'Expected at most one unversioned run object', {}, 'P1');
  return rows[0];
}

export async function readPublishRunBytes(bucket, path) {
  // A unique cache nonce and authenticated download avoid a stale public response.
  const content = dataOf(await bucket.download(path, { cacheNonce: randomUUID() }, { cache: 'no-store' }),
    'Read actual Storage bytes');
  return Buffer.from(await content.arrayBuffer());
}

export async function probeTaskMediaWrites({
  mode, database, runId, bucket, originalName, movedName, objectId, readBytes, task, readTask, originalBytes, alteredBytes,
}) {
  check(!originalBytes.equals(alteredBytes), 'Storage probes require distinct real image bytes', {}, 'P1');
  const prefix = 'uploads/distribution-m3-' + runId + '/';
  const asset = task.content_snapshot.media.find(item => item.media_id === objectId);
  const inspect = name => inspectPublishRunObject(database, runId, name);
  const initial = await inspect(originalName);
  check(asset?.original_storage_path === prefix + originalName && initial?.id === objectId && initial.version
    && (await readBytes(originalName)).equals(originalBytes), 'Task captured the original Storage UUID, path and bytes', {}, 'P1');
  check(!await inspect(movedName), 'Storage move target is unused', {}, 'P1');
  record('PASS', 'Task captured Storage UUID, original path and initial bytes', {
    run_id: runId, task_id: task.id, object_id: objectId, path: initial.name, sha256: hash(originalBytes),
  });
  let prior = initial;
  let priorBytes = originalBytes;
  let detected = 0;
  let protectedOperations = 0;
  const stages = [
    ['update', bytes => bucket.update(prefix + originalName, bytes, { contentType: 'image/webp' }), originalName],
    ['upsert', bytes => bucket.upload(prefix + originalName, bytes, { contentType: 'image/webp', upsert: true }), originalName],
    ['move', () => bucket.move(prefix + originalName, prefix + movedName), movedName],
  ];
  for (const [operation, attempt, dest] of stages) {
    const replacement = priorBytes.equals(originalBytes) ? alteredBytes : originalBytes;
    const result = await attempt(replacement);
    const source = await inspect(originalName);
    const moved = await inspect(movedName);
    const actual = source ?? moved;
    check(actual?.id === objectId && isDeepStrictEqual(await readTask(task.id), task),
      'Task remains unchanged and Storage UUID is traceable after ' + operation, {}, 'P1');
    const bytes = await readBytes(actual === moved ? movedName : originalName);
    const observations = {
      operation, ...apiEvidence(result), original_sha256: hash(priorBytes), actual_sha256: hash(bytes),
      object_id: objectId, path_before: prior.name, path_after: actual.name, uuid_preserved: actual.id === prior.id,
      path_changed: actual.name !== prior.name, source_present: Boolean(source), destination_present: Boolean(moved),
      version_changed: actual.version !== prior.version, storage_metadata_changed: !isDeepStrictEqual(actual.metadata, prior.metadata),
      task_snapshot_changed: false,
    };
    if (mode === 'baseline') {
      if (!result.error) {
        const requested = operation === 'move' ? priorBytes : replacement;
        check(bytes.equals(requested) && actual.name === prefix + dest && (dest !== movedName || !source),
          'Unprotected Storage operation produced the requested change', observations, 'P1');
        detected += !bytes.equals(priorBytes) || observations.path_changed ? 1 : 0;
      } else {
        check(bytes.equals(priorBytes) && isDeepStrictEqual(actual, prior) && !moved,
          'Rejected baseline operation left bytes, path and version intact', observations, 'P1');
      }
      record('INFO', 'Observed unprotected Storage operation', { run_id: runId, ...observations, accepted: !result.error });
    } else {
      const protectedObject = result.error?.message === guardMessage && ['AccessDenied','Unauthorized'].includes(result.error?.code)
        && !moved && isDeepStrictEqual(source, initial) && bytes.equals(originalBytes);
      protectedOperations += Number(protectedObject);
      record(protectedObject ? 'PASS' : 'FAIL', 'Real Storage task media protection', { run_id: runId, ...observations });
    }
    prior = actual;
    priorBytes = bytes;
  }
  if (mode === 'baseline') record(detected ? 'FAIL' : 'PASS', 'Baseline Storage snapshot mutability observed',
    { run_id: runId, mutable_operations: detected, expected_regression_probe: true });
  else check(protectedOperations === stages.length, 'All real Storage mutations must be rejected by the task media guard',
    { protected_operations: protectedOperations }, 'P1');
}
