import { Suspense, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LogOut,
  ExternalLink,
  Menu,
  X,
} from 'lucide-react';
import { useAdminAuth } from '../auth/useAdminAuth';
import { adminRoutes, ADMIN_LOGIN, getAdminPageTitle } from '../routes';
import { useAdminAction } from '../hooks/useAdminAction';
import { AdminFeedback } from './AdminFeedback';
import { AdminErrorBoundary } from './AdminErrorBoundary';
import { AdminLoading } from './AdminLoading';

export function AdminLayout() {
  const { user, logout } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { run, pendingKey, feedback } = useAdminAction('退出登录失败，请重试。');
  const handleLogout = () => run('logout', logout, { onSuccess: () => navigate(ADMIN_LOGIN, { replace: true }) });

  return (
    <div className="admin-body">
      <div className="admin-layout">
        {/* Sidebar */}
        <aside id="admin-sidebar" className={`admin-sidebar ${mobileNavOpen ? 'open' : ''}`}>
          <div className="admin-sidebar-brand">
            <NavLink to="/admin/dashboard" onClick={() => setMobileNavOpen(false)}>
              松屿 SONG ISLE <span className="badge">CMS</span>
            </NavLink>
            <button
              className="admin-btn admin-btn-secondary admin-btn-sm mobile-menu-toggle"
              onClick={() => setMobileNavOpen(false)}
              aria-label="关闭菜单"
            >
              <X size={16} />
            </button>
          </div>

          <nav className="admin-nav" aria-label="后台导航">
            {adminRoutes.filter(item => item.navigation).map((item) => {
              const Icon = item.navigation!.icon;
              return (
                <NavLink
                  key={item.path}
                  to={`/admin/${item.path}`}
                  className={({ isActive }) =>
                    `admin-nav-item ${isActive ? 'active' : ''}`
                  }
                  onClick={() => setMobileNavOpen(false)}
                >
                  <Icon size={18} />
                  <span>{item.navigation!.label}</span>
                </NavLink>
              );
            })}
          </nav>

          <div className="admin-sidebar-footer">
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="admin-btn admin-btn-secondary admin-btn-sm"
              style={{ width: '100%', justifyContent: 'flex-start' }}
            >
              <ExternalLink size={15} />
              <span>查看前台网站</span>
            </a>
            <button
              onClick={handleLogout}
              disabled={Boolean(pendingKey)}
              className="admin-btn admin-btn-danger admin-btn-sm"
              style={{ width: '100%', justifyContent: 'flex-start' }}
            >
              <LogOut size={15} />
              <span>退出登录</span>
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="admin-main">
          <header className="admin-topbar">
            <div className="admin-topbar-left">
              <button
                className="admin-btn admin-btn-secondary admin-btn-sm mobile-menu-toggle"
                onClick={() => setMobileNavOpen(!mobileNavOpen)}
                aria-label="切换菜单"
                aria-expanded={mobileNavOpen}
                aria-controls="admin-sidebar"
              >
                <Menu size={18} />
              </button>
              <h2 className="admin-topbar-title">{getAdminPageTitle(location.pathname)}</h2>
            </div>
            <div className="admin-topbar-right">
              <span style={{ fontSize: '13px', color: 'var(--admin-text-secondary)' }}>
                {user?.email || '管理员'}
              </span>
            </div>
          </header>

          <main className="admin-content">
            <AdminFeedback feedback={feedback} />
            <AdminErrorBoundary key={location.pathname}>
              <Suspense fallback={<AdminLoading />}><Outlet /></Suspense>
            </AdminErrorBoundary>
          </main>
        </div>
      </div>
    </div>
  );
}
