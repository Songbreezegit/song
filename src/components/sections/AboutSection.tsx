import { SiteSettingsState, type SiteSettingsProps } from '../SiteSettingsState';
import { Asset, FloatingBadge } from '../Asset';
import { ScrollReveal } from '../ScrollReveal';
import { useI18n } from '../../i18n/useI18n';

const DEFAULT_WHAT_I_BUILD = {
  zh: [
    { title: 'Native Mobile Apps', desc: '追求丝滑流畅的交互、严苛的本地隐私防护与清晰的架构设计。' },
    { title: 'Productivity Tools', desc: '把高频繁琐的日常操作，凝练为一键执行的轻量小工具与 CLI。' },
    { title: 'Personal Web Spaces', desc: '构建兼具静谧美感、工匠细节与无障碍体验的现代网络空间。' },
  ],
  en: [
    { title: 'Native Mobile Apps', desc: 'Prioritizing fluid micro-interactions, offline privacy, and clean architecture.' },
    { title: 'Productivity Tools', desc: 'Condensing repetitive workflows into single-click utilities and CLI tools.' },
    { title: 'Personal Web Spaces', desc: 'Creating quiet, accessible digital spaces with editorial craft and attention to detail.' },
  ],
  ja: [
    { title: 'Native Mobile Apps', desc: '滑らかな操作感、厳格なローカルプライバシー、美しいアーキテクチャ設計を追求。' },
    { title: 'Productivity Tools', desc: '頻繁で煩雑な日常のタスクを、ワンクリックで完結する軽量ツールやCLIに凝縮。' },
    { title: 'Personal Web Spaces', desc: '静謐な美意識、工芸的なディテール、アクセシビリティを両立したWeb空間の構築。' },
  ],
};

const DEFAULT_PATHS = {
  zh: [
    { year: '2022', event: '考入大学计算机专业，开始系统学习软件工程' },
    { year: '2023', event: '深入 Android 原生开发与现代 Web 前端' },
    { year: '2024', event: '独立完成多款开源项目，构建个人技术沉淀' },
    { year: '2025', event: '探索大模型在端侧与工作流中的智能落地' },
  ],
  en: [
    { year: '2022', event: 'Began CS degree, exploring foundational software engineering' },
    { year: '2023', event: 'Deep dive into Android native development & modern web frontend' },
    { year: '2024', event: 'Shipped independent open-source projects & technical tools' },
    { year: '2025', event: 'Exploring LLMs in edge intelligence and daily workflows' },
  ],
  ja: [
    { year: '2022', event: '大学の情報科学専攻に入学、ソフトウェア工学の探求を開始' },
    { year: '2023', event: 'ネイティブAndroid開発とモダンWebフロントエンドに専念' },
    { year: '2024', event: '複数のオープンソース作品を公開、個人ツールの開発に注力' },
    { year: '2025', event: 'エッジAIと開発ワークフローの知能化を探求中' },
  ],
};

export function AboutSection(props: SiteSettingsProps) {
  const { settings } = props;
  const { language, t } = useI18n();
  const about = settings?.about;

  const greeting = language === 'zh' ? about?.greeting || t('about.introGreeting') : t('about.introGreeting');
  const bio = language === 'zh' ? about?.bio || t('about.whoIAm.bio') : t('about.whoIAm.bio');
  const location = language === 'zh' ? about?.location || t('about.whoIAm.location') : t('about.whoIAm.location');
  const basedIn = language === 'zh' ? settings?.based_in || '中国 · 重庆' : language === 'ja' ? '中国・重慶' : 'Chongqing, China';

  const buildingVal =
    language === 'zh'
      ? settings?.currently?.building || 'SONG ISLE (个人技术内容与数字空间系统)'
      : language === 'ja'
      ? 'SONG ISLE（個人技術アーカイブ＆デジタル空間）'
      : 'SONG ISLE (Personal digital space & technical archive)';

  const learningVal =
    language === 'zh'
      ? settings?.currently?.learning || 'AI × Application Development (端侧与应用实践)'
      : language === 'ja'
      ? 'AI × アプリケーション開発（エッジ知能と実践）'
      : 'AI × Application Engineering (Edge intelligence & workflow tooling)';

  const exploringVal =
    language === 'zh'
      ? settings?.currently?.exploring || 'Developer Tools / AI / Web & Android'
      : 'Developer Tools / AI / Web & Android';

  const whatIBuildItems =
    language === 'zh' && about?.whatIDo?.length ? about.whatIDo : DEFAULT_WHAT_I_BUILD[language];

  const pathItems =
    language === 'zh' && about?.path?.length ? about.path : DEFAULT_PATHS[language];

  return (
    <section id="about" className="section about-section">
      <div className="container">
        <SiteSettingsState {...props} />
        <div className="about-top">
          <ScrollReveal className="about-title">
            <p className="eyebrow">{t('about.eyebrow')}</p>
            <h2>
              {t('about.titleMain')}
              <br />
              {t('about.titleSub1')}
              <span className="sage-text">{t('about.titleSub2')}</span>
            </h2>
            <p className="section-intro">
              {greeting}
              <br />
              {t('about.introSub')}
            </p>
            <p className="small-label">{t('about.role')}</p>
          </ScrollReveal>
          <ScrollReveal className="about-illustration">
            <Asset name="about-hero-illustration" alt={t('about.illustrationAlt')} />
            <FloatingBadge name="about-badge-curious-human" />
          </ScrollReveal>
        </div>

        <div className="about-grid">
          <ScrollReveal className="about-bio">
            <Asset name="about-icon-sprout" />
            <div>
              <p className="eyebrow">{t('about.whoIAm.eyebrow')}</p>
              <h3>{t('about.whoIAm.title')}</h3>
              <p>{bio}</p>
              <span className="small-label">{location}</span>
            </div>
          </ScrollReveal>

          <ScrollReveal className="about-now">
            <Asset name="about-icon-spark" />
            <p className="eyebrow">{t('about.whatLearning.eyebrow')}</p>
            <h3>{t('about.whatLearning.title')}</h3>
            <p>
              <strong>{t('about.whatLearning.building')}</strong>
              <br />
              {buildingVal}
            </p>
            <p>
              <strong>{t('about.whatLearning.learning')}</strong>
              <br />
              {learningVal}
            </p>
            <p>
              <strong>{t('about.whatLearning.exploring')}</strong>
              <br />
              {exploringVal}
            </p>
          </ScrollReveal>

          <ScrollReveal className="about-build">
            <Asset name="about-icon-code" />
            <p className="eyebrow">{t('about.whatBuild.eyebrow')}</p>
            {whatIBuildItems.map((item) => (
              <div key={item.title}>
                <h4>{item.title}</h4>
                <p>{item.desc}</p>
              </div>
            ))}
          </ScrollReveal>

          <ScrollReveal className="about-life">
            <Asset name="about-icon-mountain" />
            <p className="eyebrow">{t('about.awayFromKeyboard.eyebrow')}</p>
            <h3>
              {t('about.awayFromKeyboard.title1')}
              <br />
              {t('about.awayFromKeyboard.title2')}
            </h3>
            <p>{t('about.awayFromKeyboard.desc')}</p>
            <p className="small-label">{basedIn}</p>
          </ScrollReveal>
        </div>

        <details className="about-details">
          <summary>{t('about.details.summary')}</summary>
          <div className="about-details-grid">
            <div>
              <h3>{t('about.details.toolkit')}</h3>
              {(about?.techStack || []).map((g) => (
                <p key={g.category}>
                  <strong>{g.category}</strong>
                  <br />
                  {g.items.join(' / ')}
                </p>
              ))}
            </div>
            <div>
              <h3>{t('about.details.path')}</h3>
              {pathItems.map((s) => (
                <p key={s.year}>
                  <strong>{s.year}</strong> {s.event}
                </p>
              ))}
            </div>
          </div>
        </details>
        <Asset
          name="about-divider-nice-to-meet-you"
          className="section-divider"
          alt={t('about.dividerAlt')}
        />
      </div>
    </section>
  );
}
