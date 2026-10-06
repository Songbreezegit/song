import { describe, expect, it } from 'vitest';
import { getEditorReturnPath } from '../src/admin/lib/editor';

describe('content editor return destination', () => {
  it('preserves the exact collection search, category, status, sort and page', () => {
    const returnTo = '/admin/projects?q=Android+Compose&status=draft&category=android&sort=title-asc&page=2';
    expect(getEditorReturnPath('/admin/projects', { returnTo })).toBe(returnTo);
    expect(getEditorReturnPath('/admin/articles', { returnTo: '/admin/articles?q=%E5%B7%A5%E7%A8%8B&page=3' }))
      .toBe('/admin/articles?q=%E5%B7%A5%E7%A8%8B&page=3');
  });

  it.each([null, {}, { returnTo: 3 }, { returnTo: 'https://example.com/admin/projects' },
    { returnTo: '//example.com/admin/projects' }, { returnTo: 'https://admin.invalid/admin/projects' },
    { returnTo: '/admin/articles?q=draft' }, { returnTo: '/admin/projects/new' },
    { returnTo: '/admin/projects/../site' }, { returnTo: '/admin/projects-elsewhere' },
    { returnTo: '/zh/' }])('falls back to the current collection for invalid state: %j', state => {
    expect(getEditorReturnPath('/admin/projects', state)).toBe('/admin/projects');
  });
});
