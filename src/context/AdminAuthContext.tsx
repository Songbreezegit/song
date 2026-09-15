import { useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { AdminAuthContext } from './AdminAuthContextDefinition';

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      return { error: new Error('Supabase 尚未配置。请配置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY。') };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error: new Error(error.message || '登录失败，请检查邮箱与密码') };
      }

      setSession(data.session);
      setUser(data.user);
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('登录过程中发生异常') };
    }
  };

  const logout = async () => {
    if (!isSupabaseConfigured) return;
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
  };

  return (
    <AdminAuthContext.Provider
      value={{
        session,
        user,
        loading,
        isConfigured: isSupabaseConfigured,
        login,
        logout,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}
