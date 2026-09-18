import { DataState } from './DataState';
import { useEffect, useRef, useState, useMemo } from 'react';
import { X, ArrowUpRight, Copy, Check, Info } from 'lucide-react';
import { type Article, type Project, resolveProject, resolveArticle } from '../data/portfolioData';
import { useI18n } from '../i18n/useI18n';

interface DetailModalProps {
  item: Article | Project | null;
  onClose: () => void;
  pending?: boolean;
  loading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
}

export function DetailModal({
  item,
  onClose,
  pending = false,
  loading = false,
  error = null,
  onRetry,
}: DetailModalProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState('');
  const { language, t } = useI18n();

  useEffect(() => {
    if (!item && !pending) return;
    const el = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    el?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      el?.close();
      document.body.style.overflow = overflow;
      previous?.focus({ preventScroll: true });
    };
  }, [item, pending]);

  const resolvedItem = useMemo(() => {
    if (!item) return null;
    if ('features' in item) {
      return resolveProject(item, language);
    }
    if ('content' in item) {
      return resolveArticle(item, language);
    }
    return item;
  }, [item, language]);

  if (!item && !pending) return null;

  const article = resolvedItem && 'content' in resolvedItem ? resolvedItem : null;
  const project = resolvedItem && 'features' in resolvedItem ? resolvedItem : null;

  const copyCode = async (snippet: string) => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(snippet);
    } catch {
      setCopied(t('common.actions.copyFailed'));
    }
  };

  return (
    <dialog
      ref={dialog}
      className="detail-dialog"
      aria-labelledby="detail-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="detail-shell">
        <header className="detail-header">
          <div>
            <p className="eyebrow">
              {article
                ? `${article.category} / ${article.date} / ${article.readTime}`
                : `${project?.categoryLabel} / ${project?.year}`}
            </p>
            <h2 id="detail-title">{resolvedItem?.title || t('work.modal.titleFallback')}</h2>
            <p>{resolvedItem?.subtitle}</p>
          </div>
          <button
            autoFocus
            className="icon-button"
            onClick={onClose}
            aria-label={t('work.modal.closeAria')}
          >
            <X size={23} />
          </button>
        </header>
        <div className="detail-body">
          {!resolvedItem && (
            <DataState
              loading={loading}
              error={error}
              empty
              emptyMessage={t('work.modal.emptyDetail')}
              onRetry={onRetry}
            />
          )}
          {article && (
            <>
              {article.isFallback && (
                <div className="article-fallback-banner" role="status">
                  <Info size={16} />
                  <span>{t('notes.fallbackNotice')}</span>
                </div>
              )}
              <p className="detail-lead">{article.content.lead}</p>
              {article.content.sections.map((s, i) => (
                <section key={i}>
                  {s.heading && <h3>{s.heading}</h3>}
                  {s.body.map((p, j) => (
                    <p key={j}>{p}</p>
                  ))}
                  {s.quote && <blockquote>{s.quote}</blockquote>}
                  {s.code && (
                    <div className="code-block">
                      <div>
                        <span>{s.code.filename || s.code.language}</span>
                        <button onClick={() => copyCode(s.code!.snippet)}>
                          {copied === s.code.snippet ? (
                            <Check size={14} />
                          ) : (
                            <Copy size={14} />
                          )}
                          {copied === s.code.snippet
                            ? t('common.actions.copied')
                            : t('common.actions.copy')}
                        </button>
                      </div>
                      <pre>
                        <code>{s.code.snippet}</code>
                      </pre>
                    </div>
                  )}
                  {s.table && (
                    <div className="detail-table">
                      <table>
                        <thead>
                          <tr>
                            {s.table.headers.map((h, c) => (
                              <th key={c}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {s.table.rows.map((row, r) => (
                            <tr key={r}>
                              {row.map((cell, c) => (
                                <td key={c}>{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {s.callout && <aside>{s.callout.text}</aside>}
                </section>
              ))}
              <p className="detail-tags">{article.tags.map((tag) => `#${tag}`).join('  ')}</p>
            </>
          )}
          {project && (
            <>
              <p className="detail-lead">{project.overview}</p>
              <section>
                <h3>{t('work.modal.overview')}</h3>
                <ul>
                  {project.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </section>
              <section>
                <h3>{t('work.modal.techStack')}</h3>
                <p>{project.techStack.join(' / ')}</p>
              </section>
              <section>
                <h3>{t('work.modal.devNotes')}</h3>
                <p>{project.developmentNotes}</p>
                {project.challengesSolutions?.map((c) => (
                  <div key={c.challenge}>
                    <h4>{c.challenge}</h4>
                    <p>{c.solution}</p>
                  </div>
                ))}
              </section>
              <div className="cta-row">
                <a className="cta" href={project.githubUrl} target="_blank" rel="noreferrer">
                  {t('work.modal.viewSource')}
                  <ArrowUpRight size={17} />
                </a>
                {project.liveUrl && (
                  <a
                    className="cta cta-secondary"
                    href={project.liveUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('work.modal.liveDemo')}
                    <ArrowUpRight size={17} />
                  </a>
                )}
              </div>
            </>
          )}
          <span className="sr-only" role="status">
            {copied.startsWith('复制失败') || copied.startsWith('Could not') ? copied : ''}
          </span>
        </div>
      </div>
    </dialog>
  );
}
