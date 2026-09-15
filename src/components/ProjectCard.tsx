import { ArrowUpRight } from 'lucide-react';
import { Asset, type AssetName } from './Asset';
import type { Project } from '../data/portfolioData';
const visuals: Record<string, AssetName> = {
 lizhang: 'work-icon-sprout', 'online-exam': 'notes-icon-note-list', 'dev-tools': 'work-icon-layers',
 'ai-lab': 'about-icon-spark', 'open-source': 'contact-icon-github', 'fuji-photo': 'work-project-cover-fuji',
 plantly: 'notes-icon-sprout', orbit: 'about-icon-spark', flowy: 'work-icon-layers'
};
export function ProjectCard({ project, onSelect, variant = '' }: { project: Project; onSelect: (p: Project) => void; variant?: string }) {
 return <article className={`project-card ${variant} project-${project.id}`}>
  <button className="project-link" onClick={() => onSelect(project)} aria-label={`查看项目：${project.title}`}>
    <div className="project-image">{project.coverImage ? <img src={project.coverImage} alt={project.title} className="asset" loading="lazy" /> : <Asset name={visuals[project.id] ?? 'work-icon-layers'} />}<span className="project-image-label">{project.subtitle}</span></div>
   <div className="project-copy"><span className="small-label">{project.categoryLabel}</span><h3>{project.title}<ArrowUpRight size={23} /></h3><p>{project.description}</p></div>
  </button>
 </article>;
}
