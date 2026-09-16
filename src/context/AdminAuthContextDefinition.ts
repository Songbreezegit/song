import { createContext } from 'react';
import type { Session, User } from '@supabase/supabase-js';

export interface AdminAuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  authError: string | null;
  isConfigured: boolean;
  login: (email: string, password: string) => Promise<{ error: Error | null }>;
  logout: () => Promise<void>;
}

export const AdminAuthContext = createContext<AdminAuthContextType | null>(null);
