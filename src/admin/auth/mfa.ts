import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

export interface AdminTotpFactor { id: string; name: string }
export interface AdminMfaState { level: 'aal1' | 'aal2'; factors: AdminTotpFactor[] }
export interface AdminTotpEnrollment { id: string; qr: string; secret: string }

export function getSessionIdentity(session: Session | null): string | null {
  if (!session) return null;
  try {
    const payload = JSON.parse(atob(session.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.session_id === 'string' ? `${session.user.id}:${payload.session_id}` : null;
  } catch { return null; }
}

// This claim only controls UI continuity. Supabase validates the token in
// getUser, and PostgreSQL independently enforces membership and aal2.
export function getSessionAal(session: Session): 'aal1' | 'aal2' {
  try {
    const payload = session.access_token.split('.')[1];
    const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return claims.aal === 'aal2' ? 'aal2' : 'aal1';
  } catch { return 'aal1'; }
}

export async function checkAdminMfa(session: Session): Promise<AdminMfaState> {
  const { data, error } = await supabase.auth.getUser(session.access_token);
  if (error) throw error;
  if (!data.user || data.user.id !== session.user.id) throw new Error('会话已失效，请重新登录。');
  return { level: getSessionAal(session), factors: (data.user.factors || [])
    .filter(factor => factor.factor_type === 'totp' && factor.status === 'verified')
    .map(factor => ({ id: factor.id, name: factor.friendly_name || '身份验证器' })) };
}

export async function enrollAdminTotp(): Promise<AdminTotpEnrollment> {
  const existing = await supabase.auth.mfa.listFactors();
  if (existing.error) throw existing.error;
  if (existing.data.totp.length) throw new Error('已绑定身份验证器，请刷新后输入验证码。');
  // An abandoned setup cannot be resumed because its secret is not persisted.
  // Only remove unverified TOTP factors; never disable a verified factor here.
  for (const factor of existing.data.all.filter(item => item.factor_type === 'totp' && item.status === 'unverified')) {
    const result = await supabase.auth.mfa.unenroll({ factorId: factor.id });
    if (result.error) throw result.error;
  }
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'SONG ISLE', issuer: 'SONG ISLE' });
  if (error) throw error;
  return { id: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

export async function verifyAdminTotp(factorId: string, code: string): Promise<void> {
  if (!/^\d{6}$/.test(code)) throw new Error('请输入身份验证器中的 6 位验证码。');
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) throw new Error(error.status === 429 ? '验证次数过多，请稍后重试。' : (error.status || 0) >= 500
    ? '验证服务暂时不可用，请稍后重试。' : error.status === 401 ? '会话已失效，请重新登录。' : '验证码无效或已过期，请输入最新验证码。');
}
