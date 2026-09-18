import { MapPin } from 'lucide-react';
import { Asset, FloatingBadge } from '../Asset';
import { CTAButton } from '../CTAButton';
import { SiteSettingsState, type SiteSettingsProps } from '../SiteSettingsState';
import { usePointerShift } from '../../hooks/usePointerShift';
import { useI18n } from '../../i18n/useI18n';

export function HeroSection(props: SiteSettingsProps) {
  const { settings } = props;
  const { language, t } = useI18n();
  const pointer = usePointerShift({ maxOffset: 4, dampening: 0.018 });

  const introText =
    language === 'zh'
      ? settings?.site_intro || t('home.hero.defaultIntro')
      : t('home.hero.defaultIntro');

  const currentlyText =
    language === 'zh'
      ? settings?.currently?.text || 'Building small tools for a brighter day.'
      : language === 'ja'
      ? 'より良い毎日のための小さなツールを開発中'
      : 'Building small tools for a brighter day.';

  const basedInText =
    language === 'zh'
      ? settings?.based_in || '中国 · 重庆'
      : language === 'ja'
      ? '中国・重慶'
      : 'Chongqing, China';

  return (
    <section id="home" className="home-section">
      <Asset name="home-background-grid" className="hero-grid-texture" eager />
      <div className="container home-grid">
        <div className="hero-copy">
          <p className="eyebrow">{t('home.hero.eyebrow')}</p>
          <h1>
            <span className="hero-name">
              {t('home.hero.name')}
              <svg className="hero-rays" viewBox="0 0 70 70" aria-hidden="true">
                <path
                  d="M12 38 21 7M31 48 52 26M40 62 65 51"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="7"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <span>{t('home.hero.verb')}</span>
            <span className="hero-last">{t('home.hero.suffix')}</span>
          </h1>
          <SiteSettingsState {...props} />
          <p className="hero-role">{t('home.hero.role')}</p>
          <p className="hero-description">{introText}</p>
          <div className="cta-row">
            <CTAButton href={`/${language}/work`}>{t('home.hero.ctaWork')}</CTAButton>
            <CTAButton href={`/${language}/contact`} secondary>
              {t('home.hero.ctaContact')}
            </CTAButton>
          </div>
        </div>

        <div
          className="hero-art"
          onMouseMove={pointer.handleMouseMove}
          onMouseLeave={pointer.handleMouseLeave}
        >
          <div className="hero-person" style={pointer.style}>
            <Asset
              name="home-hero-illustration"
              alt={t('home.hero.illustrationAlt')}
              eager
            />
          </div>
          <FloatingBadge name="home-badge-now-building" className="home-building" />
          <FloatingBadge name="home-badge-open-source" className="home-open-source" />
        </div>

        <div className="hero-meta">
          <div>
            <span>{t('home.hero.currently')}</span>
            <p>{currentlyText}</p>
          </div>
          <div>
            <span>{t('home.hero.basedIn')}</span>
            <p>
              <MapPin size={14} />
              {basedInText}
            </p>
          </div>
        </div>

        <a
          href={`/${language}/work`}
          className="home-scroll"
          aria-label={t('home.hero.scrollAria')}
        >
          <Asset name="home-scroll-indicator" className="scroll-letter" eager />
          <Asset name="home-scroll-indicator" className="scroll-arrow" eager />
        </a>
      </div>
      <Asset name="home-decoration-leaves" className="home-leaves" />
    </section>
  );
}
