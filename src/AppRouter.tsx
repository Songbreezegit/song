import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App';

import { AdminAuthProvider } from './context/AdminAuthContext';
import { AdminAuthGuard } from './admin/components/AdminAuthGuard';

const AdminLogin = lazy(() => import('./admin/pages/AdminLogin').then((m) => ({ default: m.AdminLogin })));
const AdminLayout = lazy(() => import('./admin/components/AdminLayout').then((m) => ({ default: m.AdminLayout })));
const AdminDashboard = lazy(() => import('./admin/pages/AdminDashboard').then((m) => ({ default: m.AdminDashboard })));
const AdminProjects = lazy(() => import('./admin/pages/AdminProjects').then((m) => ({ default: m.AdminProjects })));
const AdminProjectEditor = lazy(() => import('./admin/pages/AdminProjectEditor').then((m) => ({ default: m.AdminProjectEditor })));
const AdminArticles = lazy(() => import('./admin/pages/AdminArticles').then((m) => ({ default: m.AdminArticles })));
const AdminArticleEditor = lazy(() => import('./admin/pages/AdminArticleEditor').then((m) => ({ default: m.AdminArticleEditor })));
const AdminSiteSettings = lazy(() => import('./admin/pages/AdminSiteSettings').then((m) => ({ default: m.AdminSiteSettings })));
const AdminMedia = lazy(() => import('./admin/pages/AdminMedia').then((m) => ({ default: m.AdminMedia })));

const AdminLoadingFallback = (
  <div className="admin-loading-screen">
    <div className="admin-spinner" />
    <p>正在加载管理模块...</p>
  </div>
);

export function AppRouter() {
  return (
    <BrowserRouter>
      <AdminAuthProvider>
        <Suspense fallback={AdminLoadingFallback}>
          <Routes>
            {/* Public SONG ISLE Site */}
            <Route path="/" element={<App />} />

            {/* Admin Login */}
            <Route path="/admin/login" element={<AdminLogin />} />

            {/* Admin Protected Console */}
            <Route
              path="/admin"
              element={
                <AdminAuthGuard>
                  <AdminLayout />
                </AdminAuthGuard>
              }
            >
              <Route index element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboard />} />

              <Route path="projects" element={<AdminProjects />} />
              <Route path="projects/new" element={<AdminProjectEditor />} />
              <Route path="projects/:id" element={<AdminProjectEditor />} />

              <Route path="articles" element={<AdminArticles />} />
              <Route path="articles/new" element={<AdminArticleEditor />} />
              <Route path="articles/:id" element={<AdminArticleEditor />} />

              <Route path="site" element={<AdminSiteSettings />} />
              <Route path="media" element={<AdminMedia />} />

              <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
            </Route>

            {/* Fallback to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AdminAuthProvider>
    </BrowserRouter>
  );
}

export default AppRouter;
