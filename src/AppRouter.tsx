import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import App from './App';
import { NotFoundPage } from './components/NotFoundPage';
import { I18nProvider } from './i18n/I18nProvider';
import { isSupportedLanguage, getStoredLanguage, detectBrowserLanguage } from './i18n/utils';
import { ThemeProvider } from './context/ThemeContext';
import { RouteErrorBoundary } from './components/RouteErrorBoundary';

const AdminApp = lazy(() => import('./admin/AdminApp'));

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
      <Routes>
        {/* Root language detection redirect */}
        <Route path="/" element={<RootRedirect />} />

        {/* Admin Login & Protected Console */}
        <Route path="/admin/*" element={
          <RouteErrorBoundary fallback={
            <div role="alert" style={{ padding: '60px', textAlign: 'center' }}>
              <p>无法加载管理模块，请重新加载页面。</p>
              <button type="button" onClick={() => window.location.reload()}>重新加载页面</button>
            </div>
          }>
            <Suspense fallback={<div role="status" style={{ padding: '60px', textAlign: 'center' }}>正在加载管理模块...</div>}>
              <AdminApp />
            </Suspense>
          </RouteErrorBoundary>
        } />

        {/* Public Multilingual Routes */}
        <Route path="/:lang" element={<LocalizedRoute />} />
        <Route path="/:lang/:section" element={<LocalizedRoute />} />
        <Route path="/:lang/*" element={<LocalizedDeepNotFound />} />

        {/* Fallback */}
        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRouter;
