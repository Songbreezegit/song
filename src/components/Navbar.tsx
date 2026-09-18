import { useEffect, useRef, useState } from 'react';
import { Menu, X, Moon, Sun } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Asset } from './Asset';
import { useTheme } from '../context/useTheme';
import { useI18n } from '../i18n/useI18n';
import { LanguageSwitcher } from './LanguageSwitcher';

const SECTION_KEYS = [
  { id: 'home', key: 'nav.home' },
  { id: 'work', key: 'nav.work' },
  { id: 'notes', key: 'nav.notes' },
  { id: 'about', key: 'nav.about' },
  { id: 'contact', key: 'nav.contact' },
] as const;

export function Navbar({ activeSection }: { activeSection: string }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const { theme, toggleTheme } = useTheme();
  const { language, t } = useI18n();

  useEffect(() => {
    const scroll = () => setScrolled(scrollY > 12);
    scroll();
    addEventListener('scroll', scroll, { passive: true });
    return () => removeEventListener('scroll', scroll);
  }, []);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, [open]);

  const handleNavClick = (id: string) => {
    setOpen(false);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className={`site-header ${scrolled || open ? 'scrolled' : ''}`}>
      <div className="container header-inner">
        <Link
          to={`/${language}/`}
          className="brand"
          aria-label={t('nav.ariaBrand')}
          onClick={() => handleNavClick('home')}
        >
          <Asset name="home-logo-wordmark" eager />
        </Link>

        <nav id="main-nav" aria-label={t('nav.ariaNav')} className={open ? 'nav-open' : ''}>
          {SECTION_KEYS.map(({ id, key }) => (
            <Link
              key={id}
              to={id === 'home' ? `/${language}/` : `/${language}/${id}`}
              aria-current={activeSection === id ? 'location' : undefined}
              onClick={() => handleNavClick(id)}
            >
              {t(key)}
            </Link>
          ))}
        </nav>

        <div className="header-actions">
          <LanguageSwitcher variant="desktop" />
          <button
            className="icon-button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? t('nav.ariaThemeLight') : t('nav.ariaThemeDark')}
          >
            {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
          </button>
          <Link
            className="header-note"
            to={`/${language}/about`}
            onClick={() => handleNavClick('about')}
          >
            {t('nav.stayCurious')}
          </Link>
          <button
            ref={toggle}
            className="icon-button menu-toggle"
            aria-label={open ? t('nav.ariaCloseMenu') : t('nav.ariaOpenMenu')}
            aria-expanded={open}
            aria-controls="main-nav"
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={23} /> : <Menu size={23} />}
          </button>
        </div>
      </div>
    </header>
  );
}
