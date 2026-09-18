import { ArrowUpRight } from 'lucide-react';
import { ProjectCover } from './ProjectCover';
import type { Project } from '../data/portfolioData';
import { useI18n } from '../i18n/useI18n';

export function ProjectCard({
  project,
  onSelect,
  variant = '',
}: {
  project: Project;
  onSelect: (p: Project) => void;
  variant?: string;
}) {
  const { t } = useI18n();

  return (
    <article className={`project-card ${variant}`}>
      <button
        className="project-link"
        onClick={() => onSelect(project)}
        aria-label={t('work.viewAria', { title: project.title })}
      >
        <ProjectCover src={project.coverImage} alt={project.title} />
        <div className="project-copy">
          <span className="small-label">{project.categoryLabel}</span>
          <h3>
            {project.title}
            <ArrowUpRight size={23} />
          </h3>
          <p>{project.description}</p>
        </div>
      </button>
    </article>
  );
}
