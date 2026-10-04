import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@supabase/supabase-js';
import { createSessionResolver as createResolver, type AdminSessionState } from '../src/admin/auth/sessionResolver';
import { getSessionAal } from '../src/admin/auth/mfa';

const session = (userId: string, token = userId, aal = 'aal2') => ({ user: { id: userId }, access_token: `e30.${btoa(JSON.stringify({ sub: userId, aal, nonce: token }))}.signature` } as Session);
const createSessionResolver = (verify: Parameters<typeof createResolver>[0], publish: Parameters<typeof createResolver>[1],
  check: Parameters<typeof createResolver>[2] = async value => ({ level: getSessionAal(value), factors: [{ id: 'totp', name: 'Test' }] })) => createResolver(verify, publish, check);
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('admin session resolution', () => {
  it.each([true, false])('requires MFA after password login (enrolled=%s)', async enrolled => {
    const publish = vi.fn();
    const resolver = createSessionResolver(async () => true, publish, async () => ({ level: 'aal1', factors: enrolled ? [{ id: 'totp', name: 'Test' }] : [] }));
    const result = resolver.resolve(session('admin', 'password', 'aal1'));
    await vi.runAllTimersAsync();
    expect((await result).error).toBeNull();
    expect(publish.mock.lastCall?.[0].status).toBe(enrolled ? 'mfa-required' : 'enrollment-required');
    expect(publish.mock.calls.some(([value]) => value.status === 'authorized')).toBe(false);
  });

  it('immediately stops preserving the editor when a token drops to aal1', async () => {
    const publish = vi.fn();
    const resolver = createSessionResolver(async () => true, publish);
    const initial = resolver.resolve(session('admin'));
    await vi.runAllTimersAsync(); await initial;
    const downgrade = resolver.resolve(session('admin', 'downgraded', 'aal1'));
    expect(publish.mock.lastCall?.[0].status).toBe('checking');
    await vi.runAllTimersAsync(); await downgrade;
    expect(publish.mock.lastCall?.[0].status).toBe('mfa-required');
  });

  it('fails closed if server MFA lookup fails and ignores late MFA results after logout', async () => {
    const publish = vi.fn();
    let finish!: (value: { level: 'aal2'; factors: [] }) => void;
    const check = vi.fn().mockRejectedValue(new Error('MFA unavailable'));
    const resolver = createSessionResolver(async () => true, publish, check);
    const failed = resolver.resolve(session('admin'));
    await vi.runAllTimersAsync();
    expect((await failed).error?.message).toBe('MFA unavailable');
    expect(publish.mock.lastCall?.[0].status).toBe('error');
    check.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const pending = resolver.resolve(session('admin', 'retry'));
    await vi.advanceTimersByTimeAsync(0);
    await resolver.resolve(null);
    finish({ level: 'aal2', factors: [] }); await pending;
    expect(publish.mock.lastCall?.[0].status).toBe('anonymous');
  });
  it('defers membership work outside the auth callback and shares login verification', async () => {
    const verify = vi.fn().mockResolvedValue(true);
    const publish = vi.fn();
    const resolver = createSessionResolver(verify, publish);
    const first = resolver.resolve(session('admin'));
    expect(resolver.resolve(session('admin'))).toBe(first);
    expect(verify).not.toHaveBeenCalled();
    expect(publish).toHaveBeenLastCalledWith({ session: session('admin'), status: 'checking', error: null });
    await vi.runAllTimersAsync();
    expect(await first).toEqual({ error: null });
    expect(verify).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenLastCalledWith({ session: session('admin'), status: 'authorized', error: null });
  });

  it('never grants access to a member or after a failed membership query', async () => {
    const verify = vi.fn().mockResolvedValue(false);
    const publish = vi.fn();
    const resolver = createSessionResolver(verify, publish);
    const denied = resolver.resolve(session('member'));
    await vi.runAllTimersAsync();
    expect((await denied).error?.message).toContain('没有管理员权限');
    expect(publish.mock.lastCall?.[0].status).toBe('denied');
    verify.mockRejectedValue({ message: 'membership offline' });
    const failed = resolver.resolve(session('member', 'refreshed'));
    await vi.runAllTimersAsync();
    expect((await failed).error?.message).toBe('membership offline');
    expect(publish.mock.lastCall?.[0].status).toBe('error');
  });

  it('ignores an old user response after identity changes', async () => {
    let finishOld!: (allowed: boolean) => void;
    const verify = vi.fn((id: string) => id === 'old' ? new Promise<boolean>(finish => { finishOld = finish; }) : Promise.resolve(false));
    const states: AdminSessionState[] = [];
    const resolver = createSessionResolver(verify, state => states.push(state));
    const old = resolver.resolve(session('old'));
    await vi.advanceTimersByTimeAsync(0);
    const current = resolver.resolve(session('member'));
    await vi.advanceTimersByTimeAsync(0);
    await current;
    finishOld(true);
    expect((await old).error).toBeInstanceOf(Error);
    expect(states.at(-1)?.session?.user.id).toBe('member');
    expect(states.some(state => state.status === 'authorized')).toBe(false);
  });

  it('cancels deferred verification on logout', async () => {
    const verify = vi.fn().mockResolvedValue(true);
    const publish = vi.fn();
    const resolver = createSessionResolver(verify, publish);
    const login = resolver.resolve(session('admin'));
    await resolver.resolve(null);
    await vi.runAllTimersAsync();
    expect((await login).error).toBeInstanceOf(Error);
    expect(verify).not.toHaveBeenCalled();
    expect(publish).toHaveBeenLastCalledWith({ session: null, status: 'anonymous', error: null });
  });

  it.each(['logout', 'unmount'])('ignores in-flight verification after %s', async mode => {
    let finish!: (allowed: boolean) => void;
    const publish = vi.fn();
    const resolver = createSessionResolver(() => new Promise(resolve => { finish = resolve; }), publish);
    const pending = resolver.resolve(session('admin'));
    await vi.advanceTimersByTimeAsync(0);
    if (mode === 'logout') await resolver.resolve(null);
    else resolver.invalidate();
    const calls = publish.mock.calls.length;
    finish(true);
    expect((await pending).error).toBeInstanceOf(Error);
    expect(publish).toHaveBeenCalledTimes(calls);
  });

  it('retains the same editor while rechecking a refreshed token, then revokes denied access', async () => {
    const verify = vi.fn().mockResolvedValue(true);
    const publish = vi.fn();
    const resolver = createSessionResolver(verify, publish);
    const initial = resolver.resolve(session('admin'));
    await vi.runAllTimersAsync();
    await initial;
    verify.mockResolvedValue(false);
    const refresh = resolver.resolve(session('admin', 'new-token'));
    expect(publish.mock.lastCall?.[0].status).toBe('authorized');
    await vi.runAllTimersAsync();
    await refresh;
    expect(publish.mock.lastCall?.[0].status).toBe('denied');
    expect(verify).toHaveBeenCalledTimes(2);
  });

  it('rejects late login results after disposal and supports effect reactivation', async () => {
    const verify = vi.fn().mockResolvedValue(true);
    const publish = vi.fn();
    const resolver = createSessionResolver(verify, publish);
    resolver.invalidate();
    expect(resolver.isActive()).toBe(false);
    expect((await resolver.resolve(session('admin'))).error).toBeInstanceOf(Error);
    expect((await resolver.resolve(null)).error).toBeInstanceOf(Error);
    await vi.runAllTimersAsync();
    expect(verify).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
    resolver.activate();
    const login = resolver.resolve(session('admin'));
    await vi.runAllTimersAsync();
    expect(await login).toEqual({ error: null });
    expect(publish.mock.lastCall?.[0].status).toBe('authorized');
  });
});
