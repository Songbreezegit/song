import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { ArrowRight, AlertCircle } from 'lucide-react';
import { useAdminAuth } from '../auth/useAdminAuth';
import { getAdminReturnPath } from '../routes';
import { useAdminAction } from '../hooks/useAdminAction';
import { AdminLoading } from '../components/AdminLoading';
import { AdminFeedback } from '../components/AdminFeedback';

export function AdminLogin() {
  const { login, isConfigured, isAdmin, authError, loading: authLoading } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = getAdminReturnPath((location.state as { from?: unknown } | null)?.from);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { run, pendingKey, feedback, setFeedback } = useAdminAction('登录失败，请检查账号密码');
  const loading = Boolean(pendingKey);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setFeedback({ type: 'error', message: '请输入邮箱和密码' });
      return;
    }

    await run('login', async () => {
      const { error } = await login(email, password);
      if (error) throw error;
    }, { onSuccess: () => navigate(from, { replace: true }) });
  };

  if (isAdmin) return <Navigate to={from} replace />;
  if (authLoading && !loading) return <AdminLoading screen message="正在验证管理员凭据..." />;

  return (
    <div className="admin-body">
      <div className="admin-login-wrapper">
        <div className="admin-login-card">
          <div className="admin-login-header">
            <h1>松屿 · 后台管理</h1>
            <p>SONG ISLE Content Management System</p>
          </div>

          {!isConfigured && (
            <div className="admin-alert admin-alert-info">
              <AlertCircle size={18} />
              <div>
                <strong>提示：</strong>本地尚未配置 Supabase 环境变量。请在 <code>.env.local</code> 中配置 <code>VITE_SUPABASE_URL</code> 和 <code>VITE_SUPABASE_ANON_KEY</code>。
              </div>
            </div>
          )}

          <AdminFeedback feedback={feedback || (authError ? { type: 'error', message: authError } : null)} />

          <form onSubmit={handleSubmit}>
            <div className="admin-form-group">
              <label className="admin-label" htmlFor="email">
                管理员邮箱
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="email"
                  type="email"
                  className="admin-input"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  required
                  autoFocus
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="admin-form-group">
              <label className="admin-label" htmlFor="password">
                密码
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="password"
                  type="password"
                  className="admin-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button
              type="submit"
              className="admin-btn admin-btn-primary"
              style={{ width: '100%', marginTop: '8px', padding: '10px' }}
              disabled={loading || !isConfigured}
            >
              {loading ? (
                <>
                  <div className="admin-spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                  <span>正在登录...</span>
                </>
              ) : (
                <>
                  <span>进入后台</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <div style={{ marginTop: '24px', textAlign: 'center' }}>
            <a
              href="/"
              style={{
                fontSize: '13px',
                color: 'var(--admin-text-secondary)',
                textDecoration: 'none',
              }}
            >
              ← 返回公开主页
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
