import { describe, expect, it } from 'vitest';
import { requireDenied } from '../scripts/lib/distribution-staging-checks.mjs';

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
