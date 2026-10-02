import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAdminAuth } from '../auth/useAdminAuth';
import { useAdminAction } from '../hooks/useAdminAction';
import { AdminFeedback } from './AdminFeedback';
import { AdminLoading } from './AdminLoading';
import { ADMIN_LOGIN } from '../routes';

export function AdminAuthGuard({ children }: { children: ReactNode }) {
  const { session, isAdmin, loading, authError, logout } = useAdminAuth();
  const location = useLocation();
  const action = useAdminAction('退出登录失败，请重试。');

  if (loading) {
    return <AdminLoading screen message="正在验证管理员凭据..." />;
  }

  if (!session) {
    return <Navigate to={ADMIN_LOGIN} state={{ from: location }} replace />;
  }

  if (!isAdmin) {
    return <div className="admin-loading-screen" role="alert">
      <p>{authError || '此账号没有管理员权限。'}</p>
      <AdminFeedback feedback={action.feedback} />
      <button disabled={Boolean(action.pendingKey)} onClick={() => { void action.run('logout', logout); }}>退出并返回登录</button>
    </div>;
  }

  return <>{children}</>;
}
