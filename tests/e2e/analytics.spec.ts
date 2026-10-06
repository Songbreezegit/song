import { expect, test, type Page } from '@playwright/test';
import { createProjectDraft } from '../../src/admin/features/projects/projectForm';
import { createArticleDraft } from '../../src/admin/features/articles/articleForm';
import { fixture, login } from './fixtures/backend';

const runtimeErrors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  runtimeErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => sessionStorage.setItem('song-isle-intro', 'seen'));
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
});
test.afterEach(({ page }) => { expect(runtimeErrors.get(page)).toEqual([]); });

function seedPublicRecords(state: Awaited<ReturnType<typeof fixture>>) {
  state.projects.push({ ...createProjectDraft(), id: 'analytics-project', title: 'Analytics project', slug: 'analytics-project',
    status: 'published', created_at: '', updated_at: '' },
  { ...createProjectDraft(), id: 'private-project', title: 'Private project', slug: 'private-project', status: 'draft', created_at: '', updated_at: '' });
  state.articles.push({ ...createArticleDraft(), id: 'analytics-article', title: 'Analytics article', slug: 'analytics-article',
    status: 'published', created_at: '', updated_at: '' },
  { ...createArticleDraft(), id: 'private-article', title: 'Private article', slug: 'private-article', status: 'archived', created_at: '', updated_at: '' });
}

function counts(state: Awaited<ReturnType<typeof fixture>>) {
  const count = (type: string) => state.analyticsEvents.filter(event => event.p_event_type === type).length;
  return { pageViews: count('page_view'), projects: count('project_click'), articles: count('article_click') };
}

async function navigateWithinApp(page: Page, path: string) {
  await page.evaluate(path => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
}

test('public views count document and section navigation while language, theme and detail renders stay deduplicated', async ({ page }) => {
  const state = await fixture(page);
  seedPublicRecords(state);
  await page.goto('/zh/');
  await expect(page.getByRole('button', { name: '查看项目：Analytics project', exact: true })).toBeVisible();
  await expect.poll(() => counts(state)).toEqual({ pageViews: 1, projects: 0, articles: 0 });
  await page.getByRole('group', { name: 'Language switcher' }).getByRole('button', { name: 'Switch to English', exact: true }).click();
  await expect(page).toHaveURL(/\/en\/$/);
  await page.locator('.site-header .header-actions > button.icon-button').first().click();
  await expect(page.locator('.theme-transition-origin')).toHaveCount(0);
  await expect.poll(() => counts(state)).toEqual({ pageViews: 1, projects: 0, articles: 0 });
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Work', exact: true }).click();
  await expect(page).toHaveURL(/\/en\/work$/);
  await expect.poll(() => counts(state)).toEqual({ pageViews: 2, projects: 0, articles: 0 });
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Work', exact: true }).click();
  await page.getByRole('group', { name: 'Language switcher' }).getByRole('button', { name: 'Switch to 日本語', exact: true }).click();
  await expect(page).toHaveURL(/\/ja\/work$/);
  await expect.poll(() => counts(state)).toEqual({ pageViews: 2, projects: 0, articles: 0 });
  await page.reload();
  await expect(page.getByRole('button', { name: /Analytics project/ })).toBeVisible();
  await expect.poll(() => counts(state)).toEqual({ pageViews: 3, projects: 0, articles: 0 });
  for (const event of state.analyticsEvents) {
    expect(event.p_event_id).toMatch(/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i);
    expect(Object.keys(event).sort()).toEqual(['p_content_id', 'p_event_id', 'p_event_type']);
    expect(event.p_content_id).toBeNull();
  }
});

for (const kind of ['project', 'note'] as const) {
  const counter = kind === 'project' ? 'projects' : 'articles';
  const slug = kind === 'project' ? 'analytics-project' : 'analytics-article';
  const title = kind === 'project' ? 'Analytics project' : 'Analytics article';
  test(`${kind}: successful direct details count once per opening, preserve text IDs and ignore language rerenders`, async ({ page }) => {
    const state = await fixture(page);
    seedPublicRecords(state);
    state.delay = 150;
    await page.goto(`/zh/?${kind}=${slug}`);
    await expect(page.getByRole('dialog')).toContainText(title);
    await expect.poll(() => counts(state)).toEqual({ pageViews: 1, projects: counter === 'projects' ? 1 : 0, articles: counter === 'articles' ? 1 : 0 });
    expect(state.analyticsEvents.find(event => event.p_event_type === (kind === 'project' ? 'project_click' : 'article_click'))?.p_content_id).toBe(slug);
    await navigateWithinApp(page, `/en/?${kind}=${slug}`);
    await expect(page.getByRole('dialog')).toContainText(title);
    await expect.poll(() => counts(state)[counter]).toBe(1);
    await page.locator('.detail-dialog .detail-header button.icon-button').click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: new RegExp(title) }).click();
    await expect(page.getByRole('dialog')).toContainText(title);
    await expect.poll(() => counts(state)).toEqual({ pageViews: 1, projects: counter === 'projects' ? 2 : 0, articles: counter === 'articles' ? 2 : 0 });
  });
}

for (const [kind, slug] of [['project', 'missing-project'], ['project', 'private-project'], ['note', 'missing-article'], ['note', 'private-article']]) {
  test(`${kind}=${slug}: unresolved or unpublished details never count clicks`, async ({ page }) => {
    const state = await fixture(page);
    seedPublicRecords(state);
    await page.goto(`/zh/?${kind}=${slug}`);
    await expect(page.getByRole('dialog')).toContainText('未找到内容');
    await expect.poll(() => counts(state)).toEqual({ pageViews: 1, projects: 0, articles: 0 });
  });
}

test('content and analytics failures remain independent of the public reading experience', async ({ page }) => {
  const state = await fixture(page);
  seedPublicRecords(state);
  state.trackingError = true;
  await page.goto('/zh/?project=analytics-project');
  await expect(page.getByRole('dialog')).toContainText('Analytics project');
  await expect.poll(() => state.analyticsRpcRequests.filter(request => request.name === 'record_analytics_event').length).toBe(4);
  expect(state.analyticsEvents).toEqual([]);
  await page.locator('.detail-dialog .detail-header button.icon-button').click();
  await page.getByRole('button', { name: '阅读：Analytics article', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Analytics article');
  await expect.poll(() => state.analyticsRpcRequests.filter(request => request.name === 'record_analytics_event').length).toBe(6);
  state.trackingError = false;
  state.error = true;
  await page.goto('/zh/?project=analytics-project');
  await expect(page.getByRole('dialog')).toContainText('内容加载失败');
  await expect.poll(() => counts(state)).toEqual({ pageViews: 1, projects: 0, articles: 0 });
});

test('admin login, protected pages and editor interactions never generate public visits', async ({ page }) => {
  const state = await fixture(page);
  await login(page);
  await expect(page).toHaveURL(/dashboard$/);
  for (const [destination, title] of [['projects', '项目工作区'], ['articles', '文章工作区'], ['site', '站点设置'], ['media', '媒体库'], ['projects/new', '新建项目']]) {
    await page.goto(`/admin/${destination}`);
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  }
  await page.locator('#project-title').fill('An admin draft');
  expect(state.analyticsRpcRequests.filter(request => request.name === 'record_analytics_event')).toEqual([]);
  expect(state.analyticsEvents).toEqual([]);
});

test('the dashboard displays actual totals and every content title, then requests the selected date range', async ({ page }) => {
  const state = await fixture(page);
  seedPublicRecords(state);
  state.analytics = { ...state.analytics, todayViews: 19, totalViews: 2468, periodViews: 321, articleClicks: 18, projectClicks: 12,
    daily: [{ date: '2026-10-06', pageViews: 14, articleClicks: 7, projectClicks: 4 }, { date: '2026-10-07', pageViews: 19, articleClicks: 11, projectClicks: 8 }],
    articles: [{ id: 'analytics-article', title: 'Analytics article', slug: 'analytics-article', status: 'published', clicks: 18, totalClicks: 35 },
      { id: 'private-article', title: 'Private article', slug: 'private-article', status: 'archived', clicks: 0, totalClicks: 4 }],
    projects: [{ id: 'analytics-project', title: 'Analytics project', slug: 'analytics-project', status: 'published', clicks: 12, totalClicks: 29 },
      { id: 'private-project', title: 'Private project', slug: 'private-project', status: 'draft', clicks: 0, totalClicks: 0 }],
  };
  await login(page);
  await expect(page.getByRole('heading', { name: '网站仪表盘', exact: true })).toBeVisible();
  await expect(page.getByTestId('period-views')).toHaveText('321');
  await expect(page.getByTestId('today-views')).toHaveText('19');
  await expect(page.getByTestId('total-views')).toHaveText('2,468');
  await expect(page.getByTestId('article-clicks')).toHaveText('18');
  await expect(page.getByTestId('project-clicks')).toHaveText('12');
  const content = page.getByRole('region', { name: '每篇内容点击量', exact: true });
  for (const [title, recent, total] of [['Analytics article', '18', '35'], ['Analytics project', '12', '29'], ['Private article', '0', '4'], ['Private project', '0', '0']]) {
    const row = content.getByRole('row').filter({ has: page.getByRole('link', { name: title, exact: true }) });
    await expect(row.locator('td').nth(3)).toHaveText(recent!);
    await expect(row.locator('td').nth(4)).toHaveText(total!);
  }
  await page.getByText('查看每日数据', { exact: true }).click();
  const daily = page.getByRole('table', { name: '按北京时间统计的每日访问量' });
  await expect(daily.getByRole('row').filter({ hasText: '2026-10-07' })).toContainText('19');
  await page.getByLabel('搜索统计内容', { exact: true }).fill('Analytics');
  await page.getByLabel('统计内容类型', { exact: true }).selectOption('project');
  await expect(content.getByRole('link', { name: 'Analytics project', exact: true })).toBeVisible();
  await expect(content.getByRole('link', { name: 'Analytics article', exact: true })).toHaveCount(0);
  await expect(content.getByRole('link', { name: 'Private project', exact: true })).toHaveCount(0);
  state.analytics = { ...state.analytics, periodViews: 90, articleClicks: 6, projectClicks: 3 };
  await page.getByLabel('统计时段', { exact: true }).selectOption('7');
  await expect(page.getByTestId('period-views')).toHaveText('90');
  await expect(page.getByTestId('article-clicks')).toHaveText('6');
  expect(state.analyticsRpcRequests.filter(request => request.name === 'get_admin_analytics').map(request => request.args.p_days)).toEqual([30, 7]);
  await expect(page.getByLabel('搜索统计内容', { exact: true })).toHaveValue('');
  await page.getByLabel('统计时段', { exact: true }).selectOption('90');
  await expect.poll(() => state.analyticsRpcRequests.filter(request => request.name === 'get_admin_analytics').at(-1)?.args.p_days).toBe(90);
});

test('analytics loading, errors and missing migration remain truthful and recoverable', async ({ page }) => {
  const state = await fixture(page);
  state.analyticsDelay = 700;
  state.analytics.totalViews = 123;
  state.analytics.periodViews = 17;
  await login(page);
  await expect(page.getByText('正在加载访问统计...', { exact: true })).toBeVisible();
  await expect(page.getByTestId('period-views')).toHaveText('…');
  await expect(page.getByTestId('period-views')).toHaveText('17');
  state.analyticsDelay = 0;
  state.analyticsMissing = true;
  await page.getByRole('button', { name: '刷新仪表盘', exact: true }).click();
  await expect(page.getByRole('heading', { name: '访问统计尚未启用', exact: true })).toBeVisible();
  await expect(page.getByTestId('period-views')).toHaveText('—');
  await expect(page.getByTestId('total-views')).toHaveText('—');
  await expect(page.getByRole('heading', { name: '每篇内容的表现', exact: true })).toHaveCount(0);
  state.analyticsMissing = false;
  state.analyticsError = true;
  await page.getByRole('button', { name: '刷新仪表盘', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Analytics aggregate unavailable');
  await expect(page.getByTestId('period-views')).toHaveText('—');
  await expect(page.getByRole('heading', { name: '访问统计尚未启用', exact: true })).toHaveCount(0);
  state.analyticsError = false;
  await page.getByRole('button', { name: '重新加载', exact: true }).click();
  await expect(page.getByTestId('period-views')).toHaveText('17');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('a committed analytics event with a lost HTTP response is retried without counting twice', async ({ page }) => {
  const state = await fixture(page);
  seedPublicRecords(state);
  const attempts = new Map<string, number>();
  await page.route('**/rest/v1/rpc/record_analytics_event', async route => {
    const args = route.request().postDataJSON();
    state.analyticsRpcRequests.push({ name: 'record_analytics_event', args });
    const attempt = (attempts.get(args.p_event_id) || 0) + 1;
    attempts.set(args.p_event_id, attempt);
    if (attempt === 1) {
      // Simulate PostgreSQL committing before the client loses its response.
      state.analyticsEvents.push(args);
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Response lost after commit' }) });
    } else await route.fulfill({ contentType: 'application/json', body: 'false' });
  });
  await page.goto('/zh/?project=analytics-project');
  await expect(page.getByRole('dialog')).toContainText('Analytics project');
  await expect.poll(() => [...attempts.values()]).toEqual([2, 2]);
  expect(counts(state)).toEqual({ pageViews: 1, projects: 1, articles: 0 });
  const calls = state.analyticsRpcRequests.filter(request => request.name === 'record_analytics_event');
  for (const id of attempts.keys()) {
    const matching = calls.filter(request => request.args.p_event_id === id);
    expect(matching).toHaveLength(2);
    expect(matching[0]!.args).toEqual(matching[1]!.args);
  }
});

test('leaving the public site for admin and returning through SPA history begins a new public opening', async ({ page }) => {
  const state = await fixture(page);
  seedPublicRecords(state);
  await page.goto('/zh/?note=analytics-article');
  await expect(page.getByRole('dialog')).toContainText('Analytics article');
  await expect.poll(() => counts(state)).toEqual({ pageViews: 1, projects: 0, articles: 1 });
  await navigateWithinApp(page, '/admin/login');
  await expect(page.getByRole('heading', { name: '松屿 · 后台管理', exact: true })).toBeVisible();
  expect(counts(state)).toEqual({ pageViews: 1, projects: 0, articles: 1 });
  await page.goBack();
  await expect(page).toHaveURL(/\/zh\/\?note=analytics-article$/);
  await expect(page.getByRole('dialog')).toContainText('Analytics article');
  await expect.poll(() => counts(state)).toEqual({ pageViews: 2, projects: 0, articles: 2 });
});

test('rapid date changes discard older snapshots and never label them with the newest period', async ({ page }) => {
  const state = await fixture(page);
  const requests: number[] = [];
  const releases = new Map<number, () => void>();
  await page.route('**/rest/v1/rpc/get_admin_analytics', async route => {
    const days = route.request().postDataJSON().p_days as number;
    requests.push(days);
    await new Promise<void>(resolve => releases.set(days, resolve));
    const endTime = Date.parse('2026-10-07T00:00:00Z');
    const daily = Array.from({ length: days }, (_, index) => ({ date: new Date(endTime - (days - 1 - index) * 86400000).toISOString().slice(0, 10), pageViews: 0, articleClicks: 0, projectClicks: 0 }));
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...state.analytics, days, startDate: daily[0]!.date, daily, periodViews: days * 10 }) });
  });
  await login(page);
  await expect.poll(() => requests).toEqual([30]);
  await page.getByLabel('统计时段', { exact: true }).selectOption('7');
  await expect.poll(() => requests).toEqual([30, 7]);
  await page.getByLabel('统计时段', { exact: true }).selectOption('90');
  await expect.poll(() => requests).toEqual([30, 7, 90]);
  await expect(page.getByTestId('period-views')).toHaveText('…');
  await expect(page.getByRole('heading', { name: '每篇内容的表现', exact: true })).toHaveCount(0);
  releases.get(90)!();
  await expect(page.getByTestId('period-views')).toHaveText('900');
  for (const days of [7, 30]) {
    const response = page.waitForResponse(response => response.url().endsWith('/rpc/get_admin_analytics') && response.request().postDataJSON().p_days === days);
    releases.get(days)!();
    await response;
    await expect(page.getByTestId('period-views')).toHaveText('900');
    await expect(page.getByLabel('统计时段', { exact: true })).toHaveValue('90');
  }
  await expect(page.getByRole('alert')).toHaveCount(0);
});
