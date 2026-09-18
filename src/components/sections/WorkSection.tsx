import { useState, useMemo } from 'react';
import { ArrowDown, ArrowRight } from 'lucide-react';
import { DataState, type DataStateProps } from '../DataState';
import { type Project, resolveProject } from '../../data/portfolioData';
import { Asset, FloatingBadge } from '../Asset';
import { ProjectCard } from '../ProjectCard';
import { ScrollReveal } from '../ScrollReveal';
import { useI18n } from '../../i18n/useI18n';

const selectedIds = ['lizhang', 'fuji-photo', 'online-exam', 'dev-tools'];

export function WorkSection({
  onSelectProject,
  projects,
  loading,
  error,
  onRetry,
}: {
  onSelectProject: (p: Project) => void;
  projects: Project[];
} & Omit<DataStateProps, 'empty'>) {
  const [expanded, setExpanded] = useState(false);
  const { language, t } = useI18n();

  const resolvedProjects = useMemo(() => {
    return projects.map((p) => resolveProject(p, language));
  }, [projects, language]);

  const dataList = loading || error ? [] : resolvedProjects;
  const matched = dataList.filter((p) => selectedIds.includes(p.id) || p.featured).slice(0, 4);
  const selected = matched.length > 0 ? matched : dataList.slice(0, 4);
  const other = dataList.filter((p) => !selected.some((s) => s.id === p.id));

  return (
    <section id="work" className="section work-section">
      <div className="container">
        <ScrollReveal className="work-heading">
          <div>
            <p className="eyebrow">{t('work.eyebrow')}</p>
            <h2>
              {t('work.titleMain')}
              <br />
              <span className="sage-text">{t('work.titleSub')}</span>
            </h2>
            <p className="section-intro">{t('work.intro')}</p>
          </div>
          <div className="work-illustration">
            <Asset name="work-hero-illustration" alt={t('work.illustrationAlt')} />
            <FloatingBadge name="work-badge-good-projects" />
          </div>
        </ScrollReveal>

        <DataState
          loading={loading}
          error={error}
          empty={!projects.length}
          onRetry={onRetry}
          emptyMessage={t('work.emptyMessage')}
        />

        <div className="project-grid">
          {selected.map((p, i) => (
            <ScrollReveal key={p.id} className={`project-slot slot-${i}`} delayMs={(i % 2) * 75}>
              <ProjectCard
                project={p}
                onSelect={onSelectProject}
                variant={i === 0 ? 'featured-project' : ''}
              />
            </ScrollReveal>
          ))}
        </div>

        <div className="work-tail">
          <Asset
            name="work-slogan-small-projects"
            className="work-slogan"
            alt={t('work.sloganAlt')}
          />
          <div className="work-more">
            <p className="small-label">{t('work.moreBadge')}</p>
            <button
              className="text-link"
              aria-expanded={expanded}
              aria-controls="more-projects"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? t('work.collapse') : t('work.moreCount', { count: other.length })}
              {expanded ? <ArrowDown size={18} /> : <ArrowRight size={18} />}
            </button>
          </div>
          <Asset name="work-badge-open-source" className="work-source" />
        </div>

        <div id="more-projects" hidden={!expanded} className="project-archive">
          {other.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onSelect={onSelectProject}
              variant="compact-project"
            />
          ))}
        </div>

        <Asset
          name="work-divider-more-to-explore"
          className="section-divider"
          alt="More to explore…"
        />
      </div>
    </section>
  );
}
