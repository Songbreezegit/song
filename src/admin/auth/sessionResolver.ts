import type { Session } from '@supabase/supabase-js';
import { getErrorMessage } from '../lib/feedback';

export interface AdminSessionState {
  session: Session | null;
  status: 'checking' | 'anonymous' | 'authorized' | 'denied' | 'error';
  error: string | null;
}

// Both password login and auth events use the same resolver. Membership reads
// start on a later task, after Supabase has released its auth callback lock.
export function createSessionResolver(verify: (userId: string) => Promise<boolean>, publish: (state: AdminSessionState) => void) {
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
    publish({ session, status: verifiedUser === session.user.id ? 'authorized' : 'checking', error: null });
    const promise = new Promise<void>(finish => setTimeout(finish, 0)).then(async () => {
      if (request !== generation) return cancelled();
      try {
        const allowed = await verify(session.user.id);
        if (request !== generation) return cancelled();
        const error = allowed ? null : new Error('此账号没有管理员权限。');
        verifiedUser = allowed ? session.user.id : null;
        publish({ session, status: allowed ? 'authorized' : 'denied', error: error?.message || null });
        return { error };
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
