import type { ReactNode } from 'react';
import { RouteErrorBoundary } from '../../components/RouteErrorBoundary';

export function AdminErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <RouteErrorBoundary fallback={
      <div className="admin-card" role="alert">
        <p>管理页面加载失败，请重新加载后重试。</p>
        <button type="button" className="admin-btn admin-btn-secondary" onClick={() => window.location.reload()}>重新加载页面</button>
        <a className="admin-btn admin-btn-secondary" href="/admin/dashboard">返回控制台</a>
      </div>
    }>{children}</RouteErrorBoundary>
  );
}
