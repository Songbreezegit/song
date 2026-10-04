import { describe, expect, it, vi } from 'vitest';
import { createIdleSession, ADMIN_IDLE_MS, ADMIN_IDLE_WARNING_MS } from '../src/admin/auth/idleSession';
import { validateArticleInput, validateProjectInput, validateSiteSettingsInput } from '../src/lib/contentValidation';
import { safeExternalUrl, safeImageUrl, safeMailto } from '../src/lib/safeUrl';
import { createArticleDraft } from '../src/admin/features/articles/articleForm';
import { createProjectDraft } from '../src/admin/features/projects/projectForm';
import { createSiteSettingsDraft } from '../src/admin/features/site/siteSettingsForm';

describe('content boundaries', () => {
  it.each(['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'vbscript:msgbox(1)', '//evil.example', 'https://user:secret@evil.example', 'https:\\evil.example', 'https://safe.example/\nmalicious'])('rejects unsafe URL %s at save and render', value => {
    expect(safeExternalUrl(value)).toBeUndefined();
    expect(safeImageUrl(value)).toBeUndefined();
    expect(() => validateProjectInput({ github_url: value })).toThrow();
    expect(() => validateProjectInput({ cover_image: value })).toThrow();
  });
  it('permits HTTP(S) links, local image paths and a single email address', () => {
    expect(safeExternalUrl('https://example.com/path?q=1')).toBe('https://example.com/path?q=1');
    expect(safeImageUrl('/assets/work/cover.webp')).toBe('/assets/work/cover.webp');
    expect(safeMailto('user@example.com')).toBe('mailto:user@example.com');
    expect(safeMailto('user@example.com?bcc=evil@example.com')).toBeUndefined();
    expect(() => validateProjectInput({ cover_image: '/assets/work/cover.webp' })).not.toThrow();
  });
  it('keeps code, HTML examples and SQL-like text intact', () => {
    const draft = createArticleDraft(); draft.title = 'Code'; draft.slug = 'code';
    const snippet = `<script>alert('example')</script>\n'); DROP TABLE articles; --`;
    draft.content.sections = [{ body: [snippet], code: { language: 'sql', snippet }, quote: '"quoted"' }];
    expect(() => validateArticleInput(draft, true)).not.toThrow();
    expect(draft.content.sections[0].body[0]).toBe(snippet);
    const project = { ...createProjectDraft(), title: 'Quotes', slug: "quote';--" };
    expect(() => validateProjectInput(project, true)).not.toThrow();
  });
  it('rejects invalid JSON structures, types, unknown fields and oversized payloads', () => {
    expect(() => validateArticleInput({ content: { lead: '', sections: [{ body: '<html>' }] } })).toThrow();
    expect(() => validateArticleInput({ content: { lead: '', sections: [{ body: [], code: { language: 'js', snippet: 42 } }] } })).toThrow();
    expect(() => validateProjectInput({ sort_order: 1.5 })).toThrow();
    expect(() => validateProjectInput({ featured: 'true' })).toThrow();
    expect(() => validateProjectInput({ title: 'x'.repeat(201) })).toThrow('200');
    expect(() => validateProjectInput({ id: 'overwrite' })).toThrow('不是支持的字段');
    expect(() => validateArticleInput({ content: { lead: '', sections: Array.from({ length: 100 }, () => ({ body: ['x'.repeat(20000)] })) } })).toThrow('1 MiB');
    expect(() => validateSiteSettingsInput({ about: [] })).toThrow();
    expect(() => validateSiteSettingsInput({ contact: { email: 'user@example.com?bcc=bad', github: '', x: '', bilibili: '' } })).toThrow('邮箱');
    expect(() => validateSiteSettingsInput(createSiteSettingsDraft())).not.toThrow();
  });
});

describe('admin idle session', () => {
  function clock(stored: number | null = null) {
    let now = 10000000;
    const warn = vi.fn(), expire = vi.fn();
    const options = { now: () => now, read: () => stored, write: (time: number) => { stored = time; }, warn, expire };
    return { options, warn, expire, advance: (time: number) => { now += time; }, sharedActivity: () => { stored = now; } };
  }
  it('warns two minutes before 60-minute expiry and expires once', () => {
    const task = clock(); const idle = createIdleSession(task.options);
    task.advance(ADMIN_IDLE_MS - ADMIN_IDLE_WARNING_MS); idle.check();
    expect(task.warn).toHaveBeenLastCalledWith(ADMIN_IDLE_WARNING_MS);
    task.advance(ADMIN_IDLE_WARNING_MS); idle.check(); idle.check(); idle.activity();
    expect(task.expire).toHaveBeenCalledTimes(1);
  });
  it('extends only from activity, including shared activity in another tab', () => {
    const task = clock(); const idle = createIdleSession(task.options);
    task.advance(ADMIN_IDLE_MS - 1000); idle.activity();
    task.advance(ADMIN_IDLE_MS - 1000); task.sharedActivity(); idle.check();
    expect(task.expire).not.toHaveBeenCalled();
    task.advance(ADMIN_IDLE_MS); idle.check(); expect(task.expire).toHaveBeenCalledTimes(1);
  });
  it('does not reset on token refresh/remount and cannot resume an expired session', () => {
    const task = clock(); createIdleSession(task.options);
    task.advance(ADMIN_IDLE_MS + 1000);
    const remounted = createIdleSession(task.options); remounted.activity();
    expect(task.expire).toHaveBeenCalledTimes(1);
  });
  it('ignores invalid or future shared timestamps', () => {
    const task = clock(Number.POSITIVE_INFINITY); const idle = createIdleSession(task.options);
    task.advance(ADMIN_IDLE_MS); idle.check(); expect(task.expire).toHaveBeenCalledTimes(1);
  });
});
