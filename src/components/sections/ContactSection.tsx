import { useState } from 'react';
import { ArrowUpRight, Copy, Check } from 'lucide-react';
import { SiteSettingsState, type SiteSettingsProps } from '../SiteSettingsState';
import { Asset, FloatingBadge, type AssetName } from '../Asset';
import { CTAButton } from '../CTAButton';
import { ScrollReveal } from '../ScrollReveal';
import { useI18n } from '../../i18n/useI18n';
import { safeExternalUrl, safeMailto } from '../../lib/safeUrl';
import { CONTACT_DATA, SOCIAL_PROFILES } from '../../data/portfolioData';

export function ContactSection(props: SiteSettingsProps) {
  const { language, t } = useI18n();
  const contact = props.settings?.contact;
  const emailUrl = safeMailto(contact?.email || 'dogfishgcordialf@gmail.com');
  const githubUrl = safeExternalUrl(contact?.github || 'https://github.com/Songbreezegit');

  const socials: { label: string; user: string | undefined; href: string; icon: AssetName }[] = [
    { label: 'GitHub', user: contact?.githubUser || 'Songbreezegit', href: contact?.github || 'https://github.com/Songbreezegit', icon: 'contact-icon-github' },
    { label: 'Bilibili', user: CONTACT_DATA.bilibiliUser, href: contact?.bilibili || CONTACT_DATA.bilibili, icon: 'contact-icon-bilibili' },
    { label: '小红书', ...SOCIAL_PROFILES.xiaohongshu, icon: 'contact-icon-xiaohongshu' },
    { label: '抖音', ...SOCIAL_PROFILES.douyin, icon: 'contact-icon-douyin' },
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
              {emailUrl && <CTAButton href={emailUrl}>
                {t('contact.ctaEmail')}
              </CTAButton>}
              {githubUrl && <CTAButton
                href={githubUrl}
                external
                secondary
              >
                {t('contact.ctaGithub')}
              </CTAButton>}
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
              <a href={safeMailto(contact?.email || 'dogfishgcordialf@gmail.com')}>
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
              .filter((s) => safeExternalUrl(s.href))
              .map((s) => (
                <a
                  key={s.label}
                  href={safeExternalUrl(s.href)}
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
