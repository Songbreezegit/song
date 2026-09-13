import { ArrowUpRight } from 'lucide-react';
import { Asset } from './Asset';
import type { Article } from '../data/portfolioData';
export function NoteCard({ article, onSelect, featured = false }: { article: Article; onSelect: (a: Article) => void; featured?: boolean }) {
 return <article className={featured ? 'note-featured' : 'note-row'}><button onClick={() => onSelect(article)} aria-label={`阅读：${article.title}`}>
  <div className="note-meta"><time>{article.date}</time><span>{article.category} · {article.readTime}</span></div>
  {featured && <Asset name="notes-icon-sprout" className="note-sprout" />}
  <h3>{article.title}<ArrowUpRight size={21} /></h3><p>{article.excerpt}</p>
  {featured && <span className="text-link">Read the note <ArrowUpRight size={18} /></span>}
 </button></article>;
}

