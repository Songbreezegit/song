import { expect, test } from '@playwright/test';
import { fixture, login } from './fixtures/backend';
import { createProjectDraft } from '../../src/admin/features/projects/projectForm';
import { createArticleDraft } from '../../src/admin/features/articles/articleForm';

test('populated analytics dashboard reference, desktop and mobile appearance evidence', async ({ page }, info) => {
  const runtimeErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on('pageerror', error => runtimeErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  const state = await fixture(page);
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
  state.projects.push(...['礼账 · LizhangApp', '松屿 · SONG ISLE', 'StillDue'].map((title, index) => ({ ...createProjectDraft(), title, id: `project-${index}`, slug: `project-${index}`, status: index === 2 ? 'draft' : 'published', created_at: '2026-09-01T00:00:00Z', updated_at: `2026-10-0${6 - index}T12:00:00Z` })));
  state.articles.push(...['让内容管理更顺手', '把复杂的问题慢慢拆开', '关于一次界面重构'].map((title, index) => ({ ...createArticleDraft(), title, id: `article-${index}`, slug: `article-${index}`, status: index === 2 ? 'draft' : 'published', created_at: '2026-09-01T00:00:00Z', updated_at: `2026-10-0${6 - index}T11:00:00Z` })));
  state.analytics = { ...state.analytics, todayViews: 286, totalViews: 12648, periodViews: 4238, articleClicks: 812, projectClicks: 546, totalArticleClicks: 2640, totalProjectClicks: 1802,
    daily: Array.from({ length: 30 }, (_, index) => ({ date: new Date(Date.parse('2026-09-08T00:00:00Z') + index * 86400000).toISOString().slice(0, 10), pageViews: 70 + index * 4 + Math.round(Math.sin(index * 1.8) * 40), articleClicks: 10 + index % 11, projectClicks: 7 + index % 8 })),
    articles: state.articles.map((row, index) => ({ id: row.id, title: row.title, slug: row.slug, status: row.status, clicks: [462, 350, 0][index], totalClicks: [1530, 1110, 0][index] })),
    projects: state.projects.map((row, index) => ({ id: row.id, title: row.title, slug: row.slug, status: row.status, clicks: [321, 225, 0][index], totalClicks: [1028, 774, 0][index] })),
  };
  await login(page);
  await expect(page.getByTestId('period-views')).toHaveText('4,238');
  const overflows: { viewport: string; theme: string; width: number; elements: unknown[] }[] = [];
  for (const viewport of [{ name: 'reference', width: 965, height: 723 }, { name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    for (const theme of ['light', 'dark']) {
      if (await page.evaluate(() => document.documentElement.classList.contains('dark')) !== (theme === 'dark')) {
        await page.locator('.admin-theme-toggle').click();
        await expect(page.locator('.theme-transition-origin')).toHaveCount(0);
      }
      await page.evaluate(() => scrollTo(0, 0));
      const screenshot = await page.screenshot({ path: `test-results/admin-analytics-${viewport.name}-${theme}.png`, fullPage: viewport.name !== 'reference', animations: 'disabled' });
      await info.attach(`analytics-${viewport.name}-${theme}`, { body: screenshot, contentType: 'image/png' });
      const overflow = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, elements: [...document.querySelectorAll('body *')].map(element => {
        const rect = element.getBoundingClientRect();
        return { tag: element.tagName, class: element.className, x: rect.x, right: rect.right, width: rect.width };
      }).filter(element => element.width > 0 && element.right > innerWidth + 1) }));
      if (overflow.width > viewport.width) overflows.push({ viewport: viewport.name, theme, ...overflow });
    }
  }
  await info.attach('overflow-diagnostics', { body: JSON.stringify(overflows, null, 2), contentType: 'application/json' });
  await info.attach('browser-errors', { body: JSON.stringify({ runtimeErrors, consoleErrors }, null, 2), contentType: 'application/json' });
  expect(overflows.map(({ viewport, theme, width }) => ({ viewport, theme, width }))).toEqual([]);
  expect(runtimeErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
