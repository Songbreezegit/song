import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { verifyAdmin } from '../../services/adminService';
import { getErrorMessage } from '../lib/feedback';
import { AdminAuthContext } from './AdminAuthContext';
import { createSessionResolver, type AdminSessionState } from './sessionResolver';

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AdminSessionState>({ session: null, status: isSupabaseConfigured ? 'checking' : 'anonymous', error: null });
  const resolver = useMemo(() => createSessionResolver(verifyAdmin, setState), []);

  useEffect(() => {
    resolver.activate();
    if (!isSupabaseConfigured) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { void resolver.resolve(session); });
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
      return { error: new Error(getErrorMessage(error, '登录失败')) };
    }
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

  const value = useMemo(() => ({ session: state.session, user: state.session?.user || null,
    loading: state.status === 'checking', isAdmin: state.status === 'authorized', authError: state.error,
    isConfigured: isSupabaseConfigured, login, logout }), [state, login, logout]);

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}
