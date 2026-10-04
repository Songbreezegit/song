import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { verifyAdmin } from '../../services/adminService';
import { getErrorMessage } from '../lib/feedback';
import { AdminAuthContext } from './AdminAuthContext';
import { createSessionResolver, type AdminSessionState } from './sessionResolver';
import { checkAdminMfa, getSessionIdentity } from './mfa';
import { useAdminIdleSession } from './useAdminIdleSession';

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AdminSessionState>({ session: null, status: isSupabaseConfigured ? 'checking' : 'anonymous', error: null });
  const resolver = useMemo(() => createSessionResolver(verifyAdmin, setState, checkAdminMfa), []);
  const currentSession = useRef(state.session);
  const expiredIdentity = useRef<string | null>(null);
  useEffect(() => { currentSession.current = state.session; }, [state.session]);

  useEffect(() => {
    resolver.activate();
    if (!isSupabaseConfigured) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && expiredIdentity.current && getSessionIdentity(session) === expiredIdentity.current) return;
      void resolver.resolve(session);
    });
    return () => { resolver.invalidate(); subscription.unsubscribe(); };
  }, [resolver]);

  const login = useCallback(async (email: string, password: string) => {
    if (!isSupabaseConfigured) return { error: new Error('Supabase 尚未配置。') };
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.session) throw new Error('未获取到有效登录会话，请重试。');
      return await resolver.resolve(data.session);
    } catch (error) {
      const failure = error as { status?: number; code?: string };
      return { error: new Error(failure.status === 429 ? '登录次数过多，请稍后重试。' : failure.code === 'invalid_credentials'
        ? '邮箱或密码不正确。' : getErrorMessage(error, '登录失败')) };
    }
  }, [resolver]);

  const refreshAuth = useCallback(async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) return { error };
    return resolver.resolve(data.session);
  }, [resolver]);

  const logout = useCallback(async () => {
    if (isSupabaseConfigured) {
      const { error } = await supabase.auth.signOut();
      if (error) {
        // Current auth-js versions also remove the local session on an HTTP
        // failure. Preserve the error in the provider across the login redirect.
        const message = getErrorMessage(error, '远程会话注销失败，请重试。');
        if (resolver.isActive()) {
          setState(current => ({ ...current, error: current.session ? message : `已退出当前浏览器，但远程会话注销失败：${message}` }));
        }
        throw error;
      }
    }
    await resolver.resolve(null);
  }, [resolver]);

  const expireSession = useCallback(() => {
    expiredIdentity.current = getSessionIdentity(currentSession.current);
    // Remove editor access immediately, even if remote sign-out stalls. A
    // refresh event for the expired identity cannot reopen the editor.
    void resolver.resolve(null);
    void logout().catch(() => { /* The provider retains the remote sign-out error. */ }).finally(() => {
      if (resolver.isActive()) setState(current => ({ ...current, error: current.error || '已因 60 分钟未操作退出登录。请重新登录。' }));
    });
  }, [logout, resolver]);
  const idleRemaining = useAdminIdleSession(state.session, state.status === 'authorized', expireSession);

  const value = useMemo(() => ({ session: state.session, user: state.session?.user || null,
    loading: state.status === 'checking', isAdmin: state.status === 'authorized', authError: state.error,
    isConfigured: isSupabaseConfigured, mfaRequired: state.status === 'mfa-required' || state.status === 'enrollment-required',
    needsEnrollment: state.status === 'enrollment-required', factors: state.factors || [], refreshAuth,
    idleRemaining, login, logout }), [state, login, logout, refreshAuth, idleRemaining]);

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}
