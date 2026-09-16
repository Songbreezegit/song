import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAdminAuth } from '../../context/useAdminAuth';

export function AdminAuthGuard({ children }: { children: ReactNode }) {
  const { session, isAdmin, loading, authError, logout } = useAdminAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="admin-loading-screen">
        <div className="admin-spinner" />
        <p>正在验证管理员凭据...</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  if (!isAdmin) {
    return <div className="admin-loading-screen" role="alert">
      <p>{authError || '此账号没有管理员权限。'}</p>
      <button onClick={() => { void logout().catch(() => window.location.assign('/admin/login')); }}>退出并返回登录</button>
    </div>;
  }

  return <>{children}</>;
}
