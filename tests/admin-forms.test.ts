import { describe, expect, it } from 'vitest';
import { generateContentSlug, validateContentDraft } from '../src/admin/lib/content';
import { getErrorMessage } from '../src/admin/lib/feedback';
import { createProjectDraft, projectToDraft, serializeProjectDraft } from '../src/admin/features/projects/projectForm';
import { cloneArticleSection, createArticleDraft, articleToDraft, serializeArticleDraft } from '../src/admin/features/articles/articleForm';
import { createSiteSettingsDraft, serializeSiteSettingsDraft, siteSettingsToDraft } from '../src/admin/features/site/siteSettingsForm';
import type { ArticleRecord, ProjectRecord, SiteSettingsRecord } from '../src/types/database';

describe('editor form boundaries', () => {
  it('starts every new form with independent defaults', () => {
    const first = createProjectDraft();
    first.features.push('only in this form');
    first.image_theme.type = 'terminal';
    expect(createProjectDraft().features).toEqual([]);
    expect(createProjectDraft().image_theme.type).toBe('browser');
    expect(createArticleDraft().status).toBe('draft');
    expect(createSiteSettingsDraft().about.path).toEqual([]);
  });

  it.each([NaN, Infinity, 1.5, 2147483648, -2147483649])('rejects invalid sort order %s before saving', sort_order => {
    expect(() => validateContentDraft({ title: 'Title', slug: 'title', sort_order }, '项目')).toThrow('有效整数');
  });

  it('trims project fields, preserves structured content, and strips server identity', () => {
    const draft = projectToDraft({ ...createProjectDraft(), title: ' Title ', slug: ' title ', cover_image: ' https://example.com/a.webp ',
      id: 'server', created_at: 'created', updated_at: 'updated', published_at: 'published',
      challenges_solutions: [{ challenge: '', solution: '' }, { challenge: 'Issue', solution: 'Fix' }],
    } as ProjectRecord);
    const payload = serializeProjectDraft(draft, 'published');
    expect(payload).toMatchObject({ title: 'Title', slug: 'title', status: 'published', cover_image: 'https://example.com/a.webp' });
    expect(payload.challenges_solutions).toEqual([{ challenge: 'Issue', solution: 'Fix' }]);
    for (const key of ['id', 'created_at', 'updated_at', 'published_at']) expect(payload).not.toHaveProperty(key);
  });

  it('preserves article code, table, quote, and callout when serializing', () => {
    const content = { lead: ' Lead ', sections: [{ heading: 'Heading', body: ['Paragraph'], quote: 'Quote',
      code: { language: 'ts', snippet: 'const n = 1;' }, table: { headers: ['Header'], rows: [['Cell']] },
      callout: { type: 'tip' as const, text: 'Tip' } }] };
    const draft = articleToDraft({ ...createArticleDraft(), title: ' Article ', slug: ' article ', content,
      id: 'server', created_at: 'created', updated_at: 'updated', published_at: 'published' } as ArticleRecord);
    expect(serializeArticleDraft(draft).content).toEqual({ ...content, lead: 'Lead' });
    expect(serializeArticleDraft(draft)).not.toHaveProperty('id');
  });

  it('duplicates structured sections without sharing editable nested blocks', () => {
    const section = { heading: 'Original', body: ['Paragraph'], quote: 'Quote',
      code: { language: 'typescript', snippet: 'original' }, table: { headers: ['Header'], rows: [['Cell']] },
      callout: { type: 'tip' as const, text: 'Tip' } };
    const original = structuredClone(section);
    const copy = cloneArticleSection(section);
    copy.body[0] = 'Changed paragraph';
    copy.code!.snippet = 'Changed code';
    copy.table!.rows[0]![0] = 'Changed cell';
    copy.callout!.text = 'Changed tip';
    expect(section).toEqual(original);
    expect(copy).toMatchObject({ body: ['Changed paragraph'], code: { snippet: 'Changed code' },
      table: { rows: [['Changed cell']] }, callout: { text: 'Changed tip' }, quote: 'Quote' });
  });

  it('drops blank persisted paragraphs while preserving typed content and structured blocks', () => {
    const draft = { ...createArticleDraft(), title: 'Article', slug: 'article',
      content: { lead: 'Lead', sections: [{ body: [' First paragraph ', '', ' Second paragraph ', '  '], quote: 'Quote' }] } };
    expect(serializeArticleDraft(draft).content.sections[0]).toEqual({ body: ['First paragraph', 'Second paragraph'], quote: 'Quote' });
    expect(draft.content.sections[0]!.body).toEqual([' First paragraph ', '', ' Second paragraph ', '  ']);
  });

  it('normalizes missing site JSON fields and preserves About arrays during save', () => {
    const normalized = siteSettingsToDraft({ id: 'default', site_intro: ' Intro ', based_in: ' City ', currently: {}, contact: {}, about: {}, updated_at: '' } as SiteSettingsRecord);
    normalized.about.techStack.push({ category: 'Languages', items: ['TypeScript', 'Kotlin'] });
    expect(serializeSiteSettingsDraft(normalized)).toMatchObject({ site_intro: 'Intro', based_in: 'City',
      about: { techStack: [{ category: 'Languages', items: ['TypeScript', 'Kotlin'] }], whatIDo: [], now: [], path: [] } });
    expect(normalized.currently.building).toBe('');
  });

  it('keeps slug generation and Supabase error messages consistent across editors', () => {
    expect(generateContentSlug(' Hello / 松屿! ')).toBe('hello-松屿');
    expect(getErrorMessage({ message: 'Backend rejected save' }, 'fallback')).toBe('Backend rejected save');
    expect(getErrorMessage(null, 'fallback')).toBe('fallback');
  });
});
