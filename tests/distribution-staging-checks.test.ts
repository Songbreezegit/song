import { describe, expect, it } from 'vitest';
import { requireDenied, requireMissingStorageObject } from '../scripts/lib/distribution-staging-checks.mjs';

describe('Staging Storage deletion readback', () => {
  const step = 'Deleted object is unavailable';

  it('accepts HTTP 404 and the observed HTTP 400 with a NoSuchKey body', async () => {
    await expect(requireMissingStorageObject(new Response(null, { status: 404 }), step))
      .resolves.toEqual({ http: 404, storage_status: 404 });
    const legacy = Response.json({ statusCode: '404', error: 'not_found', code: 'NoSuchKey' }, { status: 400 });
    await expect(requireMissingStorageObject(legacy, step)).resolves.toEqual({ http: 400, storage_status: 404 });
  });

  it('rejects an unrelated error, a different missing resource, or a readable file', async () => {
    for (const response of [
      Response.json({ statusCode: '400', code: 'InvalidKey' }, { status: 400 }),
      Response.json({ statusCode: '404', code: 'NoSuchBucket' }, { status: 400 }),
      new Response('not JSON', { status: 400 }),
      new Response('file bytes', { status: 200 }),
    ]) {
      await expect(requireMissingStorageObject(response, step)).rejects.toThrow(step);
    }
  });
});

describe('Staging association INSERT probes', () => {
  const step = 'distribution_post_targets INSERT';
  const relationMessage = 'Choose an enabled, unarchived account';
  const rejectedByTrigger = { status: 409, error: { code: '23503', message: relationMessage } };

  it('records the specific BEFORE trigger rejection for a relationship hidden by RLS', () => {
    expect(requireDenied(rejectedByTrigger, step, { relationMessage })).toEqual({
      step, http: 409, code: '23503', before_trigger: true,
    });
  });

  it('still accepts an explicit RLS rejection', () => {
    expect(requireDenied({ status: 403, error: { code: '42501' } }, step, { relationMessage })).toEqual({
      step, http: 403, code: '42501',
    });
  });

  it('rejects an unrelated foreign-key failure, even for a relationship insert', () => {
    const wrongConstraint = { status: 409, error: { code: '23503', message: 'foreign key constraint violation' } };
    expect(() => requireDenied(wrongConstraint, step, { relationMessage })).toThrow(step);
  });

  it('requires explicit permission rejection for anonymous inserts', () => {
    expect(() => requireDenied(rejectedByTrigger, step, { anon: true, relationMessage })).toThrow(step);
  });

  it('rejects a successful insert or a trigger error on another kind of probe', () => {
    expect(() => requireDenied({ status: 201, error: null }, step, { relationMessage })).toThrow(step);
    expect(() => requireDenied(rejectedByTrigger, 'save_distribution_post')).toThrow('save_distribution_post');
  });
});
