import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import App from './App';
import { NotFoundPage } from './components/NotFoundPage';
import { I18nProvider } from './i18n/I18nProvider';
import { isSupportedLanguage, getStoredLanguage, detectBrowserLanguage } from './i18n/utils';
import { ThemeProvider } from './context/ThemeContext';
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

const VALID_SECTIONS = ['work', 'notes', 'about', 'contact'] as const;

function RootRedirect() {
  const lang = getStoredLanguage() || detectBrowserLanguage();
  return <Navigate to={`/${lang}/`} replace />;
}

function LocalizedRoute() {
  const { lang, section } = useParams<{ lang?: string; section?: string }>();
  const navigate = useNavigate();

  // Direct section access without lang prefix (e.g. /work, /notes)
  if (lang && (VALID_SECTIONS as readonly string[]).includes(lang)) {
    const detected = getStoredLanguage() || detectBrowserLanguage();
    return <Navigate to={`/${detected}/${lang}`} replace />;
  }

  // Unsupported language code (e.g. /fr/work or /fr)
  if (!lang || !isSupportedLanguage(lang)) {
    const validSection = section && (VALID_SECTIONS as readonly string[]).includes(section) ? section : '';
    return <Navigate to={`/en/${validSection ? validSection : ''}`} replace />;
  }

  // Unsupported section (e.g. /en/something-unknown)
  if (section && !(VALID_SECTIONS as readonly string[]).includes(section)) {
    return (
      <I18nProvider language={lang} onLanguageChange={(l) => navigate(`/${l}/${section}`)}>
        <ThemeProvider>
          <NotFoundPage />
        </ThemeProvider>
      </I18nProvider>
    );
  }

  return (
    <I18nProvider language={lang} onLanguageChange={(l) => navigate(`/${l}/${section || ''}`)}>
      <App />
    </I18nProvider>
  );
}

function LocalizedDeepNotFound() {
  const { lang } = useParams<{ lang?: string }>();
  const navigate = useNavigate();
  const safeLang = lang && isSupportedLanguage(lang) ? lang : 'en';

  return (
    <I18nProvider language={safeLang} onLanguageChange={(l) => navigate(`/${l}/`)}>
      <ThemeProvider>
        <NotFoundPage />
      </ThemeProvider>
    </I18nProvider>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <AdminAuthProvider>
        <Suspense fallback={AdminLoadingFallback}>
          <Routes>
            {/* Root language detection redirect */}
            <Route path="/" element={<RootRedirect />} />

            {/* Admin Login & Protected Console */}
            <Route path="/admin/login" element={<AdminLogin />} />
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

            {/* Public Multilingual Routes */}
            <Route path="/:lang" element={<LocalizedRoute />} />
            <Route path="/:lang/:section" element={<LocalizedRoute />} />
            <Route path="/:lang/*" element={<LocalizedDeepNotFound />} />

            {/* Fallback */}
            <Route path="*" element={<RootRedirect />} />
          </Routes>
        </Suspense>
      </AdminAuthProvider>
    </BrowserRouter>
  );
}

export default AppRouter;
