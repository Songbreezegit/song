import type { ArticleRecord } from '../../../types/database';
import { validateContentDraft } from '../../lib/content';

export type ArticleDraft = Omit<ArticleRecord, 'id' | 'created_at' | 'updated_at' | 'published_at'>;
export type ArticleSection = ArticleDraft['content']['sections'][number];

export function createArticleDraft(): ArticleDraft {
  const now = new Date();
  return { title: '', slug: '', subtitle: '', category: '思考', category_slug: 'notes',
    date: `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`,
    year: String(now.getFullYear()), read_time: '3 min', excerpt: '', sort_order: 0, status: 'draft',
    tags: [], content: { lead: '', sections: [] } };
}

export function articleToDraft(record: ArticleRecord): ArticleDraft {
  const { id: _id, created_at: _created, updated_at: _updated, published_at: _published, ...fields } = record;
  return { ...createArticleDraft(), ...fields, tags: fields.tags || [],
    content: { lead: fields.content?.lead || '', sections: fields.content?.sections || [] } };
}

export function serializeArticleDraft(draft: ArticleDraft, status = draft.status): ArticleDraft {
  validateContentDraft(draft, '文章');
  return { ...draft, status, title: draft.title.trim(), slug: draft.slug.trim(), subtitle: draft.subtitle.trim(),
    category: draft.category.trim(), date: draft.date.trim(), year: draft.year.trim(), read_time: draft.read_time.trim(),
    excerpt: draft.excerpt.trim(), content: { ...draft.content, lead: draft.content.lead.trim() } };
}

export const articleCategories: { value: ArticleDraft['category_slug']; label: string }[] = [
  { value: 'notes', label: '思考与随笔 (notes)' }, { value: 'development', label: '工程与开发 (development)' },
  { value: 'tools', label: '工具与配置 (tools)' }, { value: 'ai', label: 'AI 与实验 (ai)' },
  { value: 'tutorial', label: '教程指南 (tutorial)' },
];
