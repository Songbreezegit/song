import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { verifyAdmin } from '../services/adminService';
import { AdminAuthContext } from './AdminAuthContextDefinition';

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const generation = useRef(0);
  const verifiedUser = useRef<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    const resolveSession = (next: Session | null) => {
      const request = ++generation.current;
      const alreadyVerified = Boolean(next && next.user.id === verifiedUser.current);
      setSession(next);
      if (!alreadyVerified) setIsAdmin(false);
      setAuthError(null);
      setLoading(Boolean(next) && !alreadyVerified);
      if (!next) { verifiedUser.current = null; return; }
      // Defer API work until the auth callback has released its lock.
      setTimeout(() => {
        if (!active || request !== generation.current) return;
        verifyAdmin(next.user.id).then((allowed) => {
          if (!active || request !== generation.current) return;
          verifiedUser.current = allowed ? next.user.id : null;
          setIsAdmin(allowed);
          setAuthError(allowed ? null : '此账号没有管理员权限。');
        }).catch((error: unknown) => {
          if (active && request === generation.current) {
            verifiedUser.current = null;
            setIsAdmin(false);
            setAuthError(error instanceof Error ? error.message : '管理员权限验证失败');
          }
        }).finally(() => {
          if (active && request === generation.current) setLoading(false);
        });
      }, 0);
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => resolveSession(next));
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  const login = async (email: string, password: string) => {
    if (!isSupabaseConfigured) return { error: new Error('Supabase 尚未配置。') };
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.user || !await verifyAdmin(data.user.id)) throw new Error('此账号没有管理员权限。');
      return { error: null };
    } catch (error) {
      return { error: error instanceof Error ? error : new Error('登录失败') };
    }
  };

  const logout = async () => {
    ++generation.current;
    verifiedUser.current = null;
    setIsAdmin(false);
    setSession(null);
    setAuthError(null);
    if (isSupabaseConfigured) {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    }
  };

  return <AdminAuthContext.Provider value={{ session, user: session?.user ?? null,
    isAdmin, authError, loading, isConfigured: isSupabaseConfigured, login, logout }}>
    {children}
  </AdminAuthContext.Provider>;
}
