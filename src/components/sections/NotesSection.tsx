import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { ARTICLES, type Article } from '../../data/portfolioData';
import { Asset, FloatingBadge } from '../Asset';
import { NoteCard } from '../NoteCard';
import { ScrollReveal } from '../ScrollReveal';
export function NotesSection({ onSelectArticle, articles = ARTICLES }: { onSelectArticle: (a: Article) => void; articles?: Article[] }) {
 const [expanded, setExpanded] = useState(false);
 const [filter, setFilter] = useState('全部');
 const dataList = articles.length > 0 ? articles : ARTICLES;
 const categories = ['全部', ...new Set(dataList.map(a => a.category))];
 const featuredArticle = dataList[0] || ARTICLES[0]!;
 const stackArticles = dataList.slice(1, 4);
 const archive = dataList.slice(4).filter(a => filter === '全部' || a.category === filter);
 return <section id="notes" className="section notes-section"><div className="container">
  <ScrollReveal className="notes-heading"><div className="notes-illustration"><Asset name="notes-hero-illustration" alt="松屿坐在书本和植物旁写笔记，猫在一旁小憩" /><FloatingBadge name="notes-badge-self-learning" /></div><div><p className="eyebrow">02 / Notes to myself</p><h2>Learning.<br />A little, <span className="sage-text">every day.</span></h2><p className="section-intro">记录一些想法、学习笔记、开发心得，<br />还有生活里不时冒出来的思考。</p></div></ScrollReveal>
  <div className="notes-grid"><ScrollReveal><NoteCard article={featuredArticle} onSelect={onSelectArticle} featured /></ScrollReveal><div className="note-stack">{stackArticles.map((a,i) => <ScrollReveal key={a.id} delayMs={i*75}><NoteCard article={a} onSelect={onSelectArticle} /></ScrollReveal>)}</div></div>
  <div className="notes-bottom"><div><p className="small-label">A GROWING COLLECTION OF THOUGHTS</p><button className="text-link" aria-expanded={expanded} aria-controls="notes-archive" onClick={() => setExpanded(!expanded)}>{expanded ? '收起笔记' : `浏览全部 ${dataList.length} 篇笔记`}<ArrowRight size={18} /></button></div><Asset name="notes-slogan-small-notes" className="notes-slogan" alt="Small Notes. Big Thoughts." /></div>
  <div id="notes-archive" hidden={!expanded}><div className="note-filters" aria-label="按笔记分类筛选">{categories.map(c => <button key={c} aria-pressed={filter === c} onClick={() => setFilter(c)}>{c}</button>)}</div><div className="note-archive-list">{archive.length ? archive.map(a => <NoteCard key={a.id} article={a} onSelect={onSelectArticle} />) : <p className="empty-notes">此分类的笔记已展示在上方。</p>}</div></div>
 </div></section>;
}

