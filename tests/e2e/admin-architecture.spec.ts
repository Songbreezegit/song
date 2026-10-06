import { test, expect, type Page } from '@playwright/test';
import { createProjectDraft } from '../../src/admin/features/projects/projectForm';
import { createArticleDraft } from '../../src/admin/features/articles/articleForm';
import { fixture, login } from './fixtures/backend';

const runtimeErrors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const errors: string[] = [];
  runtimeErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
});
test.afterEach(({ page }) => { expect(runtimeErrors.get(page)).toEqual([]); });

async function navigateWithinApp(page: Page, path: string) {
  await page.evaluate(path => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
}

test('public languages never initialize admin authentication or load admin modules', async ({ page }) => {
  const state = await fixture(page);
  await login(page);
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  await expect(page.locator('.admin-stat-value').first()).toHaveText('0');
  expect(state.membershipRequests).toBe(2);
  const adminScripts: string[] = [];
  page.on('request', request => {
    if (/\/src\/(?:admin\/|services\/adminService)/.test(request.url())) adminScripts.push(request.url());
  });
  const reads = state.membershipRequests;
  for (const language of ['zh', 'en', 'ja']) {
    await page.goto(`/${language}/`);
    await expect(page.locator('#home')).toBeVisible();
  }
  expect(state.membershipRequests).toBe(reads);
  expect(adminScripts).toEqual([]);
});

test('login restores the complete protected destination', async ({ page }) => {
  await fixture(page);
  await page.goto('/admin/projects/new?from=list#cover');
  await expect(page).toHaveURL(/\/admin\/login$/);
  await login(page, false);
  await expect(page).toHaveURL(/\/admin\/projects\/new\?from=list#cover$/);
  await expect(page.locator('#project-title')).toHaveValue('');
});

test('page lazy loading retains the sidebar and header', async ({ page }) => {
  await fixture(page);
  await login(page);
  await expect(page).toHaveURL(/dashboard$/);
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/src/admin/pages/AdminProjects.tsx*', async route => { await pending; await route.continue(); });
  await page.getByRole('navigation', { name: '后台导航' }).getByRole('link', { name: '项目管理', exact: true }).click();
  await expect(page.locator('.admin-content')).toContainText('正在加载管理模块');
  await expect(page.getByRole('navigation', { name: '后台导航' })).toBeVisible();
  await expect(page.locator('.admin-topbar')).toBeVisible();
  await expect(page.getByRole('navigation', { name: '后台页面导航' }).getByRole('link', { name: '项目管理', exact: true })).toHaveAttribute('aria-current', 'page');
  release();
  await expect(page.getByText('暂无项目记录。')).toBeVisible();
});

for (const kind of ['projects', 'articles'] as const) {
  const prefix = kind === 'projects' ? 'project' : 'article';
  const label = kind === 'projects' ? '项目' : '文章';
  const createDraft = kind === 'projects' ? createProjectDraft : createArticleDraft;

  test(`${kind}: changing route identity resets the draft and rejects an older load`, async ({ page }) => {
    const state = await fixture(page);
    const first = { ...createDraft(), id: 'first', title: 'First record', slug: 'first', created_at: '', updated_at: '' };
    const second = { ...createDraft(), id: 'second', title: 'Second record', slug: 'second', created_at: '', updated_at: '' };
    state[kind].push(first, second);
    await login(page);
    await expect(page).toHaveURL(/dashboard$/);
    await navigateWithinApp(page, `/admin/${kind}/first`);
    await expect(page.locator(`#${prefix}-title`)).toHaveValue('First record');

    let release!: () => void;
    let started!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    const loading = new Promise<void>(resolve => { started = resolve; });
    await page.route(`**/rest/v1/${kind}?**`, async route => {
      if (new URL(route.request().url()).searchParams.get('id') !== 'eq.second') return route.fallback();
      started();
      await pending;
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify([second]) });
    });
    await navigateWithinApp(page, `/admin/${kind}/second`);
    await loading;
    await expect(page.locator('.admin-content')).toContainText(`正在加载${label}数据`);
    await navigateWithinApp(page, `/admin/${kind}/new`);
    await expect(page.locator(`#${prefix}-title`)).toHaveValue('');
    await expect(page.locator(`#${prefix}-status`)).toHaveValue('draft');
    await page.locator(`#${prefix}-title`).fill('New unsaved record');
    const response = page.waitForResponse(response => new URL(response.url()).searchParams.get('id') === 'eq.second');
    release();
    await response;
    await expect(page.locator(`#${prefix}-title`)).toHaveValue('New unsaved record');
  });

  test(`${kind}: failed loads have a retry state and missing records cannot be saved`, async ({ page }) => {
    const state = await fixture(page);
    await login(page);
    await expect(page).toHaveURL(/dashboard$/);
    state.error = true;
    await navigateWithinApp(page, `/admin/${kind}`);
    await expect(page.getByRole('alert')).toContainText('test query failure');
    await expect(page.getByText(`暂无${label}记录。`)).toHaveCount(0);
    state.error = false;
    await page.getByRole('button', { name: '重新加载', exact: true }).click();
    await expect(page.getByText(`暂无${label}记录。`)).toBeVisible();
    await navigateWithinApp(page, `/admin/${kind}/missing`);
    await expect(page.getByRole('alert')).toContainText(`未找到指定${label}`);
    await expect(page.getByRole('button', { name: '保存当前状态' })).toHaveCount(0);
    state[kind].push({ ...createDraft(), id: 'missing', title: 'Recovered record', slug: 'recovered', created_at: '', updated_at: '' });
    await page.getByRole('button', { name: '重新加载', exact: true }).click();
    await expect(page.locator(`#${prefix}-title`)).toHaveValue('Recovered record');
  });

  test(`${kind}: duplicate form submissions create one record and check its slug once`, async ({ page }) => {
    const state = await fixture(page);
    await login(page);
    await expect(page).toHaveURL(/dashboard$/);
    await navigateWithinApp(page, `/admin/${kind}/new`);
    await page.locator(`#${prefix}-title`).fill('One record');
    await page.locator(`#${prefix}-slug`).fill('one-record');
    state.delay = 200;
    await page.locator('form').evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
    await expect(page).toHaveURL(new RegExp(`/admin/${kind}/created-0$`));
    await expect(page.locator(`#${prefix}-title`)).toHaveValue('One record');
    expect(state[kind]).toHaveLength(1);
    expect(state.requests.filter(request => request.method === 'POST' && request.pathname.endsWith(`/${kind}`))).toHaveLength(1);
    expect(state.requests.filter(request => request.method === 'GET' && request.pathname.endsWith(`/${kind}`) && new URLSearchParams(request.search).has('slug'))).toHaveLength(1);
  });
}

test('finishing a save after leaving the editor never navigates back', async ({ page }) => {
  const state = await fixture(page);
  await login(page);
  await expect(page).toHaveURL(/dashboard$/);
  await navigateWithinApp(page, '/admin/projects/new');
  await page.locator('#project-title').fill('Background save');
  await page.locator('#project-slug').fill('background-save');
  state.delay = 500;
  const request = page.waitForRequest(request => request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/projects'));
  const response = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname.endsWith('/projects'));
  await page.getByRole('button', { name: '保存当前状态', exact: true }).click();
  await request;
  await page.getByRole('navigation', { name: '后台导航' }).getByRole('link', { name: '仪表盘', exact: true }).click();
  await response;
  await expect(page).toHaveURL(/dashboard$/);
  await expect(page.locator('.admin-stat-value').first()).toHaveText('1');
});

test('media and settings failures can be retried without showing a usable empty editor', async ({ page }) => {
  const state = await fixture(page);
  await login(page);
  await expect(page).toHaveURL(/dashboard$/);
  state.mediaError = true;
  await navigateWithinApp(page, '/admin/media');
  await expect(page.getByRole('alert')).toContainText('Media unavailable');
  await expect(page.getByText('媒体库中暂无已上传的文件。')).toHaveCount(0);
  state.mediaError = false;
  await page.getByRole('button', { name: '重新加载', exact: true }).click();
  await expect(page.getByText('媒体库中暂无已上传的文件。')).toBeVisible();
  state.error = true;
  await navigateWithinApp(page, '/admin/site');
  await expect(page.getByRole('alert')).toContainText('test query failure');
  await expect(page.getByRole('button', { name: '保存全站设置' })).toHaveCount(0);
  state.error = false;
  state.site_settings = [];
  await page.getByRole('button', { name: '重新加载', exact: true }).click();
  await expect(page.locator('#site-intro')).toHaveValue('');
  await page.locator('#site-intro').fill('Initial settings');
  await page.getByRole('button', { name: '保存全站设置', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('站点设置已成功保存');
  expect(state.site_settings[0].about).toMatchObject({ whatIDo: [], techStack: [], now: [], path: [] });
});

test('remote sign-out failure stays visible after local logout, and the next login clears it', async ({ page }) => {
  const state = await fixture(page);
  await login(page);
  await expect(page).toHaveURL(/dashboard$/);
  state.logoutError = true;
  await page.getByRole('button', { name: '退出登录', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Sign out unavailable');
  await expect(page.getByRole('alert')).toContainText('已退出当前浏览器');
  await expect(page).toHaveURL(/\/admin\/login$/);
  state.logoutError = false;
  await login(page, false);
  await expect(page).toHaveURL(/dashboard$/);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('button', { name: '退出登录', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.goto('/admin/site');
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test('mobile navigation remains usable on the protected console', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixture(page);
  await login(page);
  await expect(page).toHaveURL(/dashboard$/);
  await page.getByRole('button', { name: '切换菜单', exact: true }).click();
  await expect(page.locator('.admin-topbar button[aria-controls="admin-sidebar"]')).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('navigation', { name: '后台导航' }).getByRole('link', { name: '项目管理', exact: true }).click();
  await expect(page.getByRole('button', { name: '切换菜单', exact: true })).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('heading', { name: '项目工作区', exact: true })).toBeVisible();
  await expect(page.getByText('暂无项目记录。')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('admin-projects-mobile.png') });
});

test('a newer refresh wins even when an older list response finishes last', async ({ page }) => {
  await fixture(page);
  await login(page);
  await expect(page).toHaveURL(/dashboard$/);
  await navigateWithinApp(page, '/admin/projects');
  await expect(page.getByText('暂无项目记录。')).toBeVisible();
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  let requests = 0;
  const record = { ...createProjectDraft(), id: 'current', title: 'Current record', slug: 'current', updated_at: '', created_at: '' };
  await page.route('**/rest/v1/projects?**', async route => {
    const first = ++requests === 1;
    if (first) await pending;
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([{ ...record, title: first ? 'Old record' : 'Current record' }]) });
  });
  await page.getByTitle('刷新', { exact: true }).evaluate(button => { button.click(); button.click(); });
  await expect(page.getByText('Current record', { exact: true })).toBeVisible();
  const response = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/projects'));
  release();
  await response;
  await expect(page.getByText('Current record', { exact: true })).toBeVisible();
  await expect(page.getByText('Old record', { exact: true })).toHaveCount(0);
});

test('a failed page chunk keeps navigation usable and clears its boundary on the next route', async ({ page }) => {
  await fixture(page);
  await login(page);
  await expect(page.locator('.admin-stat-value').first()).toHaveText('0');
  await page.route('**/src/admin/pages/AdminProjects.tsx*', route => route.abort());
  await page.getByRole('navigation', { name: '后台导航' }).getByRole('link', { name: '项目管理', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('管理页面加载失败');
  await expect(page.getByRole('navigation', { name: '后台导航' })).toBeVisible();
  await page.getByRole('navigation', { name: '后台导航' }).getByRole('link', { name: '仪表盘', exact: true }).click();
  await expect(page.locator('.admin-stat-value').first()).toHaveText('0');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('a failed admin entry chunk has a recoverable fallback', async ({ page }) => {
  await page.route('**/src/admin/AdminApp.tsx*', route => route.abort());
  await page.goto('/admin/login');
  await expect(page.getByRole('alert')).toContainText('无法加载管理模块');
  await expect(page.getByRole('button', { name: '重新加载页面', exact: true })).toBeVisible();
});
