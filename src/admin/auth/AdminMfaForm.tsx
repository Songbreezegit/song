import { useState, type FormEvent } from 'react';
import { useAdminAuth } from './useAdminAuth';
import { enrollAdminTotp, verifyAdminTotp, type AdminTotpEnrollment } from './mfa';
import { useAdminAction } from '../hooks/useAdminAction';
import { AdminFeedback } from '../components/AdminFeedback';

export function AdminMfaForm() {
  const { needsEnrollment, factors, refreshAuth, logout } = useAdminAuth();
  const [enrollment, setEnrollment] = useState<AdminTotpEnrollment | null>(null);
  const [factorId, setFactorId] = useState(factors[0]?.id || '');
  const [code, setCode] = useState('');
  const action = useAdminAction('二次验证失败，请重试。');
  const pending = Boolean(action.pendingKey);

  const beginEnrollment = () => action.run('enroll', enrollAdminTotp, { onSuccess: data => setEnrollment(data) });
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await action.run('verify', async () => {
      await verifyAdminTotp(enrollment?.id || factorId, code);
      const { error } = await refreshAuth();
      if (error) throw error;
    }, { onSuccess: () => { setCode(''); setEnrollment(null); } });
  };
  const cancel = () => action.run('logout', logout, { onSuccess: () => { setCode(''); setEnrollment(null); } });

  return <>
    <h2>{needsEnrollment ? '绑定身份验证器' : '二次验证'}</h2>
    <p className="admin-label-desc">{needsEnrollment ? '使用手机身份验证器扫描二维码，然后输入生成的验证码。请妥善备份验证器，避免丢失手机后无法登录。' : '请输入身份验证器中当前显示的 6 位验证码。'}</p>
    <AdminFeedback feedback={action.feedback} />
    {needsEnrollment && !enrollment ? <button className="admin-btn admin-btn-primary" disabled={pending} onClick={beginEnrollment}>开始绑定</button> : <form onSubmit={submit}>
      {enrollment && <div className="admin-mfa-setup">
        <img width="220" height="220" alt="身份验证器绑定二维码" src={enrollment.qr.startsWith('data:image/svg+xml') ? enrollment.qr : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(enrollment.qr)}`} />
        <details><summary>无法扫码？手动输入密钥</summary><code className="admin-mfa-secret">{enrollment.secret}</code></details>
      </div>}
      {!needsEnrollment && factors.length > 1 && <div className="admin-form-group">
        <label className="admin-label" htmlFor="mfa-factor">身份验证器</label>
        <select id="mfa-factor" className="admin-input" value={factorId} onChange={event => setFactorId(event.target.value)} disabled={pending}>
          {factors.map(factor => <option key={factor.id} value={factor.id}>{factor.name}</option>)}
        </select>
      </div>}
      <div className="admin-form-group">
        <label className="admin-label" htmlFor="mfa-code">6 位验证码</label>
        <input id="mfa-code" className="admin-input" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} disabled={pending} required autoFocus />
      </div>
      <button className="admin-btn admin-btn-primary" type="submit" disabled={pending}>{pending ? '正在验证...' : needsEnrollment ? '确认绑定并进入后台' : '验证并进入后台'}</button>
    </form>}
    <p className="admin-label-desc">验证器丢失时，请通过 Supabase 项目控制台恢复账号的 MFA，然后重新绑定。</p>
    <button className="admin-btn admin-btn-secondary" disabled={pending} onClick={cancel}>退出并返回登录</button>
  </>;
}
