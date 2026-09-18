import { useState } from 'react';
import { ArrowUpRight, Copy, Check } from 'lucide-react';
import { SiteSettingsState, type SiteSettingsProps } from '../SiteSettingsState';
import { Asset, FloatingBadge, type AssetName } from '../Asset';
import { CTAButton } from '../CTAButton';
import { ScrollReveal } from '../ScrollReveal';
import { useI18n } from '../../i18n/useI18n';

export function ContactSection(props: SiteSettingsProps) {
  const { language, t } = useI18n();
  const contact = props.settings?.contact;

  const socials: { label: string; user: string | undefined; href: string; icon: AssetName }[] = [
    { label: 'GitHub', user: contact?.githubUser || 'Songbreezegit', href: contact?.github || 'https://github.com/Songbreezegit', icon: 'contact-icon-github' },
    { label: 'X / Twitter', user: contact?.xUser || '@song_breezed', href: contact?.x || 'https://x.com/song_breezed', icon: 'contact-icon-x' },
    { label: 'Bilibili', user: contact?.bilibiliUser || '松屿Song', href: contact?.bilibili || 'https://space.bilibili.com/399489276', icon: 'contact-icon-bilibili' },
  ];

  const [copy, setCopy] = useState('');

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(contact?.email || 'dogfishgcordialf@gmail.com');
      setCopy(t('contact.emailCopied'));
    } catch {
      setCopy(t('contact.copyFailed'));
    }
  };

  const statusText =
    language === 'zh' ? contact?.status || t('contact.statusDefault') : t('contact.statusDefault');

  return (
    <section id="contact" className="section contact-section">
      <div className="container">
        <SiteSettingsState {...props} />
        <div className="contact-top">
          <ScrollReveal className="contact-copy">
            <p className="eyebrow">{t('contact.eyebrow')}</p>
            <h2>
              {t('contact.titleMain')}
              <br />
              <span className="sage-text">{t('contact.titleSub1')}</span>
              <br />
              {t('contact.titleSub2')}
            </h2>
            <p className="section-intro">{t('contact.intro')}</p>
            <div className="cta-row">
              <CTAButton href={`mailto:${contact?.email || 'dogfishgcordialf@gmail.com'}`}>
                {t('contact.ctaEmail')}
              </CTAButton>
              <CTAButton
                href={contact?.github || 'https://github.com/Songbreezegit'}
                external
                secondary
              >
                {t('contact.ctaGithub')}
              </CTAButton>
            </div>
          </ScrollReveal>
          <ScrollReveal className="contact-illustration">
            <Asset
              name="contact-hero-illustration"
              alt={t('contact.illustrationAlt')}
            />
            <FloatingBadge name="contact-badge-open-for-ideas" />
          </ScrollReveal>
        </div>

        <div className="contact-links">
          <div className="email-link">
            <Asset name="about-icon-envelope" />
            <div>
              <span className="small-label">{t('contact.dropLine')}</span>
              <a href={`mailto:${contact?.email || 'dogfishgcordialf@gmail.com'}`}>
                {contact?.email || 'dogfishgcordialf@gmail.com'}
              </a>
            </div>
            <button
              className="icon-button"
              onClick={copyEmail}
              aria-label={t('contact.copyEmailAria')}
            >
              {copy === t('contact.emailCopied') ? <Check size={18} /> : <Copy size={18} />}
            </button>
            <span className="copy-status" role="status">
              {copy}
            </span>
          </div>

          <div className="socials">
            {socials
              .filter((s) => s.href)
              .map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  className="social-link"
                >
                  <Asset name={s.icon} />
                  <span>
                    <strong>{s.label}</strong>
                    <small>{s.user}</small>
                  </span>
                  <ArrowUpRight size={18} />
                </a>
              ))}
          </div>
        </div>

        <div className="contact-signoff">
          <Asset name="contact-icon-message" />
          <p>
            {t('contact.signoff')}
            <span>{statusText}</span>
          </p>
          <Asset name="contact-icon-link" />
        </div>
      </div>
    </section>
  );
}
