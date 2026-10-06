import { Suspense, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, ExternalLink, Menu, X, ChevronRight, Leaf } from 'lucide-react';
import { useAdminAuth } from '../auth/useAdminAuth';
import { adminRoutes, ADMIN_LOGIN, getAdminPageTitle } from '../routes';
import { useAdminAction } from '../hooks/useAdminAction';
import { AdminFeedback } from './AdminFeedback';
import { AdminErrorBoundary } from './AdminErrorBoundary';
import { AdminLoading } from './AdminLoading';

export function AdminLayout() {
  const { user, logout, idleRemaining } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const wasMobileNavOpen = useRef(false);
  const { run, pendingKey, feedback } = useAdminAction('退出登录失败，请重试。');
  const handleLogout = () => run('logout', logout, { onSuccess: () => navigate(ADMIN_LOGIN, { replace: true }) });
  const closeMenu = () => setMobileNavOpen(false);
  const parent = location.pathname.startsWith('/admin/projects/') ? { path: '/admin/projects', title: '项目管理' }
    : location.pathname.startsWith('/admin/articles/') ? { path: '/admin/articles', title: '文章管理' } : null;

  useEffect(() => {
    if (!mobileNavOpen) {
      if (wasMobileNavOpen.current && window.matchMedia('(max-width: 900px)').matches) menuButton.current?.focus();
      wasMobileNavOpen.current = false;
      return;
    }
    wasMobileNavOpen.current = true;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sidebar.current?.querySelector<HTMLElement>('a')?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileNavOpen(false);
      }
      if (event.key !== 'Tab') return;
      const elements = [...(sidebar.current?.querySelectorAll<HTMLElement>('a, button:not(:disabled)') || [])]
        .filter(element => element.getClientRects().length > 0);
      const first = elements[0];
      const last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', handleKey);
    const desktop = window.matchMedia('(min-width: 901px)');
    const onDesktop = () => { if (desktop.matches) setMobileNavOpen(false); };
    desktop.addEventListener('change', onDesktop);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKey);
      desktop.removeEventListener('change', onDesktop);
    };
  }, [mobileNavOpen]);

  return <div className="admin-body">
    <a className="admin-skip-link" href="#admin-content">跳到主要内容</a>
    <div className="admin-layout">
      {mobileNavOpen && <button type="button" className="admin-sidebar-backdrop" onClick={closeMenu} aria-label="关闭导航遮罩" />}
      <aside ref={sidebar} id="admin-sidebar" className={`admin-sidebar ${mobileNavOpen ? 'open' : ''}`}>
        <div className="admin-sidebar-brand">
          <NavLink to="/admin/dashboard" onClick={() => setMobileNavOpen(false)}>
            <span className="admin-brand-symbol"><Leaf size={21} /></span>
            <span>松屿<span className="admin-brand-caption">SONG ISLE</span></span>
          </NavLink>
          <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm mobile-menu-toggle" onClick={closeMenu} aria-label="关闭菜单"><X size={16} /></button>
        </div>
        <nav className="admin-nav" aria-label="后台导航">
          <span className="admin-nav-caption">内容工作台</span>
          {adminRoutes.filter(item => item.navigation).map(item => {
            const Icon = item.navigation!.icon;
            return <NavLink key={item.path} to={`/admin/${item.path}`}
              className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setMobileNavOpen(false)}>
              <Icon size={18} /><span>{item.navigation!.label}</span>
            </NavLink>;
          })}
        </nav>
        <div className="admin-sidebar-footer">
          <div className="admin-sidebar-note"><span className="admin-status-dot" />个人内容管理</div>
          <a href="/" target="_blank" rel="noreferrer" className="admin-sidebar-action"><ExternalLink size={16} />查看前台网站</a>
          <button type="button" onClick={handleLogout} disabled={Boolean(pendingKey)} className="admin-sidebar-action"><LogOut size={16} />退出登录</button>
        </div>
      </aside>
      <div className="admin-main" inert={mobileNavOpen ? true : undefined}>
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <button ref={menuButton} type="button" className="admin-btn admin-btn-secondary admin-btn-sm mobile-menu-toggle"
              onClick={() => setMobileNavOpen(true)} aria-label="切换菜单" aria-expanded={mobileNavOpen} aria-controls="admin-sidebar"><Menu size={18} /></button>
            <div className="admin-breadcrumb">
              <span className="admin-breadcrumb-root">工作台</span><ChevronRight size={13} className="admin-breadcrumb-root" />
              {parent && <><Link to={parent.path}>{parent.title}</Link><ChevronRight size={13} /></>}
              <span className="admin-topbar-title" aria-current="page">{getAdminPageTitle(location.pathname)}</span>
            </div>
          </div>
          <div className="admin-topbar-right">
            <span className="admin-user-avatar" aria-hidden="true">{(user?.email || 'S').slice(0, 1).toUpperCase()}</span>
            <span className="admin-user-email">{user?.email || '管理员'}</span>
          </div>
        </header>
        <main id="admin-content" className="admin-content" tabIndex={-1}>
          {idleRemaining !== null && <div className="admin-alert admin-alert-info" role="alert">
            将在 {Math.ceil(idleRemaining / 1000)} 秒后因闲置退出。请及时保存未提交的内容；继续操作可延长会话。
          </div>}
          <AdminFeedback feedback={feedback} />
          <AdminErrorBoundary key={location.pathname}><Suspense fallback={<AdminLoading />}><Outlet /></Suspense></AdminErrorBoundary>
        </main>
      </div>
    </div>
  </div>;
}
