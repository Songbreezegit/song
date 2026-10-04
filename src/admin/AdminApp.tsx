import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminAuthProvider } from './auth/AdminAuthProvider';
import { AdminAuthGuard } from './components/AdminAuthGuard';
import { AdminErrorBoundary } from './components/AdminErrorBoundary';
import { AdminLayout } from './components/AdminLayout';
import { AdminLoading } from './components/AdminLoading';
import { ADMIN_HOME, adminRoutes } from './routes';
import './admin.css';

const AdminLogin = lazy(() => import('./pages/AdminLogin').then(m => ({ default: m.AdminLogin })));

export default function AdminApp() {
  return (
    <AdminAuthProvider>
      <AdminErrorBoundary>
        <Suspense fallback={<AdminLoading screen />}>
          <Routes>
            <Route path="login" element={<AdminLogin />} />
            <Route element={<AdminAuthGuard><AdminLayout /></AdminAuthGuard>}>
              <Route index element={<Navigate to={ADMIN_HOME} replace />} />
              {adminRoutes.map(({ path, component: Page }) => <Route key={path} path={path} element={<Page />} />)}
              <Route path="*" element={<Navigate to={ADMIN_HOME} replace />} />
            </Route>
          </Routes>
        </Suspense>
      </AdminErrorBoundary>
    </AdminAuthProvider>
  );
}
