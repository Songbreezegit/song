import { useLocation, useNavigate } from 'react-router-dom';
import { SUPPORTED_LANGUAGES, LANGUAGE_METAS } from '../i18n/config';
import type { SupportedLanguage } from '../i18n/types';
import { useI18n } from '../i18n/useI18n';
import { buildLocalizedPath } from '../i18n/utils';

interface LanguageSwitcherProps {
  variant?: 'desktop' | 'mobile';
  className?: string;
  onLanguageSelect?: () => void;
}

export function LanguageSwitcher({
  className = '',
  onLanguageSelect,
}: LanguageSwitcherProps) {
  const { language, setLanguage } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();

  const handleSwitch = (target: SupportedLanguage) => {
    if (target === language) {
      onLanguageSelect?.();
      return;
    }
    setLanguage(target);
    const targetPath = buildLocalizedPath(location.pathname, target);
    navigate(
      {
        pathname: targetPath,
        search: location.search,
        hash: location.hash,
      },
      { replace: false }
    );
    onLanguageSelect?.();
  };

  return (
    <div
      className={`lang-switcher-desktop ${className}`.trim()}
      role="group"
      aria-label="Language switcher"
    >
      {SUPPORTED_LANGUAGES.map((lang, idx) => {
        const meta = LANGUAGE_METAS[lang];
        const isActive = language === lang;
        return (
          <span key={lang} className="lang-item-wrap">
            <button
              type="button"
              className={`lang-btn ${isActive ? 'is-active' : ''}`}
              onClick={() => handleSwitch(lang)}
              aria-pressed={isActive}
              aria-label={`Switch to ${meta.label}`}
            >
              {meta.short}
            </button>
            {idx < SUPPORTED_LANGUAGES.length - 1 && (
              <span className="lang-sep" aria-hidden="true">
                /
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
