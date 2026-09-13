import { useEffect, useRef, useState } from 'react';
import { X, ArrowUpRight, Copy, Check } from 'lucide-react';
import type { Article, Project } from '../data/portfolioData';
interface DetailModalProps { item: Article | Project | null; onClose: () => void; onCopyEmail?: () => void }
export function DetailModal({ item, onClose }: DetailModalProps) {
 const dialog = useRef<HTMLDialogElement>(null);
 const [copied, setCopied] = useState('');
 useEffect(() => {
  if (!item) return;
  const el = dialog.current;
  const previous = document.activeElement as HTMLElement | null;
  const overflow = document.body.style.overflow;
  el?.showModal(); document.body.style.overflow = 'hidden';
  return () => { el?.close(); document.body.style.overflow = overflow; previous?.focus({ preventScroll: true }); };
 }, [item]);
 if (!item) return null;
 const article = 'content' in item ? item : null;
 const project = 'features' in item ? item : null;
 const copyCode = async (snippet: string) => { try { await navigator.clipboard.writeText(snippet); setCopied(snippet); } catch { setCopied('复制失败，请手动选择代码'); } };
 return <dialog ref={dialog} className="detail-dialog" aria-labelledby="detail-title" onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
  <div className="detail-shell"><header className="detail-header"><div><p className="eyebrow">{article ? `${article.category} / ${article.date} / ${article.readTime}` : `${project?.categoryLabel} / ${project?.year}`}</p><h2 id="detail-title">{item.title}</h2><p>{item.subtitle}</p></div><button autoFocus className="icon-button" onClick={onClose} aria-label="关闭详情"><X size={23} /></button></header>
  <div className="detail-body">
   {article && <><p className="detail-lead">{article.content.lead}</p>{article.content.sections.map((s,i) => <section key={i}>{s.heading && <h3>{s.heading}</h3>}{s.body.map((p,j) => <p key={j}>{p}</p>)}{s.quote && <blockquote>{s.quote}</blockquote>}{s.code && <div className="code-block"><div><span>{s.code.filename || s.code.language}</span><button onClick={() => copyCode(s.code!.snippet)}>{copied === s.code.snippet ? <Check size={14} /> : <Copy size={14} />}{copied === s.code.snippet ? '已复制' : '复制'}</button></div><pre><code>{s.code.snippet}</code></pre></div>}{s.table && <div className="detail-table"><table><thead><tr>{s.table.headers.map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{s.table.rows.map((row,r) => <tr key={r}>{row.map((cell,c) => <td key={c}>{cell}</td>)}</tr>)}</tbody></table></div>}{s.callout && <aside>{s.callout.text}</aside>}</section>)}<p className="detail-tags">{article.tags.map(t => `#${t}`).join('  ')}</p></>}
   {project && <><p className="detail-lead">{project.overview}</p><section><h3>主要特性</h3><ul>{project.features.map(f => <li key={f}>{f}</li>)}</ul></section><section><h3>技术栈</h3><p>{project.techStack.join(' / ')}</p></section><section><h3>工程思考</h3><p>{project.developmentNotes}</p>{project.challengesSolutions?.map(c => <div key={c.challenge}><h4>{c.challenge}</h4><p>{c.solution}</p></div>)}</section><div className="cta-row"><a className="cta" href={project.githubUrl} target="_blank" rel="noreferrer">查看源码<ArrowUpRight size={17} /></a>{project.liveUrl && <a className="cta cta-secondary" href={project.liveUrl} target="_blank" rel="noreferrer">在线预览<ArrowUpRight size={17} /></a>}</div></>}
   <span className="sr-only" role="status">{copied.startsWith('复制失败') ? copied : ''}</span>
  </div></div>
 </dialog>;
}
