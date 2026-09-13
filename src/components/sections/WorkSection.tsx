import { useState } from 'react';
import { ArrowDown, ArrowRight } from 'lucide-react';
import { PROJECTS, type Project } from '../../data/portfolioData';
import { Asset, FloatingBadge } from '../Asset';
import { ProjectCard } from '../ProjectCard';
import { ScrollReveal } from '../ScrollReveal';
const selectedIds = ['lizhang', 'fuji-photo', 'online-exam', 'dev-tools'];
export function WorkSection({ onSelectProject }: { onSelectProject: (p: Project) => void }) {
 const [expanded, setExpanded] = useState(false);
 const selected = selectedIds.map(id => PROJECTS.find(p => p.id === id)!);
 const other = PROJECTS.filter(p => !selectedIds.includes(p.id));
 return <section id="work" className="section work-section"><div className="container">
  <ScrollReveal className="work-heading"><div><p className="eyebrow">01 / Selected work</p><h2>Small projects.<br /><span className="sage-text">Useful things.</span></h2><p className="section-intro">用代码和设计，做一些让生活更好的小东西。</p></div>
   <div className="work-illustration"><Asset name="work-hero-illustration" alt="松屿在桌前与猫一起构建项目" /><FloatingBadge name="work-badge-good-projects" /></div>
  </ScrollReveal>
  <div className="project-grid">{selected.map((p, i) => <ScrollReveal key={p.id} className={`project-slot slot-${i}`} delayMs={i % 2 * 75}><ProjectCard project={p} onSelect={onSelectProject} variant={i === 0 ? 'featured-project' : ''} /></ScrollReveal>)}</div>
  <div className="work-tail"><Asset name="work-slogan-small-projects" className="work-slogan" alt="Small Projects. Big Changes." /><div className="work-more"><p className="small-label">EXPERIMENTS, TOOLS & OPEN SOURCE</p><button className="text-link" aria-expanded={expanded} aria-controls="more-projects" onClick={() => setExpanded(!expanded)}>{expanded ? '收起项目' : `还有 ${other.length} 个项目，继续看看`}{expanded ? <ArrowDown size={18} /> : <ArrowRight size={18} />}</button></div><Asset name="work-badge-open-source" className="work-source" /></div>
  <div id="more-projects" hidden={!expanded} className="project-archive">{other.map(p => <ProjectCard key={p.id} project={p} onSelect={onSelectProject} variant="compact-project" />)}</div>
  <Asset name="work-divider-more-to-explore" className="section-divider" alt="More to explore…" />
 </div></section>;
}

