import { useState, useMemo } from 'react';
import { ArrowRight } from 'lucide-react';
import { DataState, type DataStateProps } from '../DataState';
import { type Article, resolveArticle } from '../../data/portfolioData';
import { Asset, FloatingBadge } from '../Asset';
import { NoteCard } from '../NoteCard';
import { ScrollReveal } from '../ScrollReveal';
import { useI18n } from '../../i18n/useI18n';

export function NotesSection({
  onSelectArticle,
  articles,
  loading,
  error,
  onRetry,
}: {
  onSelectArticle: (a: Article) => void;
  articles: Article[];
} & Omit<DataStateProps, 'empty'>) {
  const [expanded, setExpanded] = useState(false);
  const { language, t } = useI18n();

  const allLabel = t('notes.allCategory');
  const [filter, setFilter] = useState('ALL');

  const resolvedArticles = useMemo(() => {
    return articles.map((a) => resolveArticle(a, language));
  }, [articles, language]);

  const dataList = loading || error ? [] : resolvedArticles;
  const rawCategories = [...new Set(dataList.map((a) => a.category))];
  const categories = [allLabel, ...rawCategories];

  const featuredArticle = dataList[0];
  const stackArticles = dataList.slice(1, 4);
  const archive = dataList
    .slice(4)
    .filter((a) => filter === 'ALL' || filter === allLabel || a.category === filter);

  return (
    <section id="notes" className="section notes-section">
      <div className="container">
        <ScrollReveal className="notes-heading">
          <div className="notes-illustration">
            <Asset
              name="notes-hero-illustration"
              alt={t('notes.illustrationAlt')}
            />
            <FloatingBadge name="notes-badge-self-learning" />
          </div>
          <div>
            <p className="eyebrow">{t('notes.eyebrow')}</p>
            <h2>
              {t('notes.titleMain')}
              <br />
              {t('notes.titleSub1')}
              <span className="sage-text">{t('notes.titleSub2')}</span>
            </h2>
            <p className="section-intro">{t('notes.intro')}</p>
          </div>
        </ScrollReveal>

        <DataState
          loading={loading}
          error={error}
          empty={!articles.length}
          onRetry={onRetry}
          emptyMessage={t('notes.emptyMessage')}
        />

        <div className="notes-grid">
          {featuredArticle && (
            <ScrollReveal>
              <NoteCard article={featuredArticle} onSelect={onSelectArticle} featured />
            </ScrollReveal>
          )}
          <div className="note-stack">
            {stackArticles.map((a, i) => (
              <ScrollReveal key={a.id} delayMs={i * 75}>
                <NoteCard article={a} onSelect={onSelectArticle} />
              </ScrollReveal>
            ))}
          </div>
        </div>

        <div className="notes-bottom">
          <div>
            <p className="small-label">{t('notes.archiveBadge')}</p>
            <button
              className="text-link"
              aria-expanded={expanded}
              aria-controls="notes-archive"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? t('notes.collapse') : t('notes.browseAll', { count: dataList.length })}
              <ArrowRight size={18} />
            </button>
          </div>
          <Asset
            name="notes-slogan-small-notes"
            className="notes-slogan"
            alt={t('notes.sloganAlt')}
          />
        </div>

        <div id="notes-archive" hidden={!expanded}>
          <div className="note-filters" aria-label={t('notes.filterAria')}>
            {categories.map((c) => {
              const isAll = c === allLabel;
              const isSelected = isAll ? filter === 'ALL' || filter === allLabel : filter === c;
              return (
                <button
                  key={c}
                  aria-pressed={isSelected}
                  onClick={() => setFilter(isAll ? 'ALL' : c)}
                >
                  {c}
                </button>
              );
            })}
          </div>
          <div className="note-archive-list">
            {archive.length ? (
              archive.map((a) => <NoteCard key={a.id} article={a} onSelect={onSelectArticle} />)
            ) : (
              <p className="empty-notes">{t('notes.emptyCategory')}</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
