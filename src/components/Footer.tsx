import { ArrowUp } from 'lucide-react';
import { useI18n } from '../i18n/useI18n';

export function FooterRegistration() {
  return (
    <div className="footer-registration">
      <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer" lang="zh-CN">
        渝ICP备2026025309号-1
      </a>
    </div>
  );
}

export function Footer() {
  const { language, t } = useI18n();

  const handleBackToTop = (e: React.MouseEvent) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <a href={`/${language}/`} onClick={handleBackToTop} className="footer-brand">
          SONG ISLE
          <span>{t('common.brandSubtitle')}</span>
        </a>
        <div className="footer-meta">
          <span>{t('common.copyright', { year: new Date().getFullYear() })}</span>
          <FooterRegistration />
        </div>
        <a href={`/${language}/`} onClick={handleBackToTop} className="text-link">
          {t('common.backToTop')}
          <ArrowUp size={16} />
        </a>
      </div>
    </footer>
  );
}
