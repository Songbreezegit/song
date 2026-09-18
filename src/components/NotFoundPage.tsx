import { Link } from 'react-router-dom';
import { Asset } from './Asset';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useI18n } from '../i18n/useI18n';
import { useTheme } from '../context/useTheme';
import { Moon, Sun, ArrowLeft } from 'lucide-react';

export function NotFoundPage() {
  const { language, t } = useI18n();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="not-found-page">
      <header className="site-header scrolled">
        <div className="container header-inner">
          <Link to={`/${language}/`} className="brand" aria-label="SONG ISLE">
            <Asset name="home-logo-wordmark" eager />
          </Link>
          <div className="header-actions">
            <LanguageSwitcher variant="desktop" />
            <button
              className="icon-button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? t('common.nav.ariaThemeLight') : t('common.nav.ariaThemeDark')}
            >
              {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
            </button>
          </div>
        </div>
      </header>

      <main className="not-found-main container">
        <div className="not-found-content">
          <p className="not-found-badge">{t('common.notFound.badge')}</p>
          <h1 className="not-found-title">{t('common.notFound.title')}</h1>
          <p className="not-found-desc">{t('common.notFound.description')}</p>
          <div className="not-found-actions">
            <Link to={`/${language}/`} className="cta">
              <ArrowLeft size={16} />
              {t('common.notFound.backHome')}
            </Link>
          </div>
        </div>
      </main>

      <footer className="site-footer">
        <div className="container footer-inner">
          <Link to={`/${language}/`} className="footer-brand">
            SONG ISLE<span>Small things, made with care.</span>
          </Link>
          <span>© {new Date().getFullYear()} 松屿</span>
        </div>
      </footer>
    </div>
  );
}
