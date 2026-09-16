import { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderGit2,
  FileText,
  Sliders,
  Image as ImageIcon,
  LogOut,
  ExternalLink,
  Menu,
  X,
} from 'lucide-react';
import { useAdminAuth } from '../../context/useAdminAuth';
import '../admin.css';

const navItems = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/projects', label: 'Projects', icon: FolderGit2 },
  { to: '/admin/articles', label: 'Articles', icon: FileText },
  { to: '/admin/site', label: 'Site Settings', icon: Sliders },
  { to: '/admin/media', label: 'Media Library', icon: ImageIcon },
];

export function AdminLayout() {
  const { user, logout } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  const getPageTitle = () => {
    const path = location.pathname;
    if (path.includes('/admin/projects/new')) return '新建项目';
    if (path.includes('/admin/projects/')) return '编辑项目';
    if (path === '/admin/projects') return '项目管理';
    if (path.includes('/admin/articles/new')) return '新建文章';
    if (path.includes('/admin/articles/')) return '编辑文章';
    if (path === '/admin/articles') return '文章管理';
    if (path === '/admin/site') return '站点设置';
    if (path === '/admin/media') return '媒体资源';
    return '管理控制台';
  };

  return (
    <div className="admin-body">
      <div className="admin-layout">
        {/* Sidebar */}
        <aside className={`admin-sidebar ${mobileNavOpen ? 'open' : ''}`}>
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

          <nav className="admin-nav">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `admin-nav-item ${isActive ? 'active' : ''}`
                  }
                  onClick={() => setMobileNavOpen(false)}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
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
              >
                <Menu size={18} />
              </button>
              <h2 className="admin-topbar-title">{getPageTitle()}</h2>
            </div>
            <div className="admin-topbar-right">
              <span style={{ fontSize: '13px', color: 'var(--admin-text-secondary)' }}>
                {user?.email || '管理员'}
              </span>
            </div>
          </header>

          <main className="admin-content">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
