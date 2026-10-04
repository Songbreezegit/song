import type { Session } from '@supabase/supabase-js';
import { getErrorMessage } from '../lib/feedback';
import { getSessionAal, type AdminMfaState, type AdminTotpFactor } from './mfa';

export interface AdminSessionState {
  session: Session | null;
  status: 'checking' | 'anonymous' | 'authorized' | 'denied' | 'error' | 'mfa-required' | 'enrollment-required';
  error: string | null;
  factors?: AdminTotpFactor[];
}

// Both password login and auth events use the same resolver. Membership reads
// start on a later task, after Supabase has released its auth callback lock.
export function createSessionResolver(verify: (userId: string) => Promise<boolean>, publish: (state: AdminSessionState) => void,
  checkMfa: (session: Session) => Promise<AdminMfaState>) {
  let generation = 0;
  let active = true;
  let verifiedUser: string | null = null;
  let pending: { token: string; userId: string; promise: Promise<{ error: Error | null }> } | null = null;
  const cancelled = () => ({ error: new Error('会话已失效，请重新登录。') });

  const resolve = (session: Session | null): Promise<{ error: Error | null }> => {
    if (!active) return Promise.resolve(cancelled());
    if (session && pending?.token === session.access_token && pending.userId === session.user.id) return pending.promise;
    const request = ++generation;
    if (!session) {
      pending = null;
      verifiedUser = null;
      publish({ session: null, status: 'anonymous', error: null });
      return Promise.resolve({ error: null });
    }
    // Rechecking the same user after refresh/focus keeps the editor mounted.
    // A changed identity always waits for a fresh membership check.
    publish({ session, status: verifiedUser === session.user.id && getSessionAal(session) === 'aal2' ? 'authorized' : 'checking', error: null });
    const promise = new Promise<void>(finish => setTimeout(finish, 0)).then(async () => {
      if (request !== generation) return cancelled();
      try {
        const allowed = await verify(session.user.id);
        if (request !== generation) return cancelled();
        if (!allowed) {
          const error = new Error('此账号没有管理员权限。');
          verifiedUser = null;
          publish({ session, status: 'denied', error: error.message });
          return { error };
        }
        const mfa = await checkMfa(session);
        if (request !== generation) return cancelled();
        verifiedUser = mfa.level === 'aal2' ? session.user.id : null;
        if (mfa.level === 'aal2') publish({ session, status: 'authorized', error: null });
        else publish({ session, status: mfa.factors.length ? 'mfa-required' : 'enrollment-required', factors: mfa.factors, error: null });
        return { error: null };
      } catch (failure) {
        if (request !== generation) return cancelled();
        const error = new Error(getErrorMessage(failure, '管理员权限验证失败'));
        verifiedUser = null;
        publish({ session, status: 'error', error: error.message });
        return { error };
      } finally {
        if (request === generation) pending = null;
      }
    });
    pending = { token: session.access_token, userId: session.user.id, promise };
    return promise;
  };

  return {
    resolve,
    activate: () => { active = true; },
    isActive: () => active,
    invalidate: () => { active = false; ++generation; pending = null; verifiedUser = null; },
  };
}
