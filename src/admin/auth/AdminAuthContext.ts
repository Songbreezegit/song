import { createContext } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import type { AdminTotpFactor } from './mfa';

export interface AdminAuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  authError: string | null;
  isConfigured: boolean;
  mfaRequired: boolean;
  needsEnrollment: boolean;
  factors: AdminTotpFactor[];
  idleRemaining: number | null;
  refreshAuth: () => Promise<{ error: Error | null }>;
  login: (email: string, password: string) => Promise<{ error: Error | null }>;
  logout: () => Promise<void>;
}

export const AdminAuthContext = createContext<AdminAuthContextType | null>(null);
