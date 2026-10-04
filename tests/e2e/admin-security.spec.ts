import { expect, test } from '@playwright/test';
import { fixture, login, passwordLogin } from './fixtures/backend';

test('password login cannot enter admin routes until the TOTP challenge succeeds', async ({ page }) => {
  const state = await fixture(page);
  await page.goto('/admin/projects/new?from=secure#cover');
  await passwordLogin(page, false);
  await expect(page.getByLabel('6 位验证码')).toBeVisible();
  expect(state.requests.some(request => request.pathname.endsWith('/projects'))).toBe(false);
  await page.getByLabel('6 位验证码').fill('000000');
  await page.getByRole('button', { name: '验证并进入后台', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('验证码无效或已过期');
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.getByLabel('6 位验证码').fill('123456');
  await page.getByRole('button', { name: '验证并进入后台', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/projects\/new\?from=secure#cover$/);
});

test('first enrollment creates one factor, retries and keeps its secret out of browser storage', async ({ page }) => {
  const state = await fixture(page); state.factors = []; state.enrollError = true;
  await passwordLogin(page);
  await expect(page.getByRole('heading', { name: '绑定身份验证器' })).toBeVisible();
  await page.getByRole('button', { name: '开始绑定' }).click();
  await expect(page.getByRole('alert')).toContainText('Enrollment unavailable');
  state.enrollError = false;
  await page.getByRole('button', { name: '开始绑定' }).dblclick();
  await expect(page.getByAltText('身份验证器绑定二维码')).toBeVisible();
  expect(state.requests.filter(request => request.method === 'POST' && request.pathname.endsWith('/factors'))).toHaveLength(2);
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain('FIXTURESECRET');
  await page.getByLabel('6 位验证码').fill('123456');
  await page.getByRole('button', { name: '确认绑定并进入后台' }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  expect(state.factors[0].status).toBe('verified');
  await page.getByRole('button', { name: '退出登录', exact: true }).click();
  await passwordLogin(page, false);
  await expect(page.getByRole('heading', { name: '二次验证', exact: true })).toBeVisible();
  await expect(page.getByAltText('身份验证器绑定二维码')).toHaveCount(0);
});

test('abandoned unverified factors are replaced, and MFA lookup failures deny entry', async ({ page }) => {
  const state = await fixture(page); state.factors[0].status = 'unverified';
  await passwordLogin(page);
  await page.getByRole('button', { name: '开始绑定' }).click();
  await expect(page.getByAltText('身份验证器绑定二维码')).toBeVisible();
  expect(state.requests.filter(request => request.method === 'DELETE' && request.pathname.includes('/factors/'))).toHaveLength(1);
  state.mfaError = true;
  await page.goto('/admin/projects');
  await expect(page.getByRole('alert')).toContainText('MFA unavailable');
  await expect(page.getByRole('navigation', { name: '后台导航' })).toHaveCount(0);
});

test('Auth rate limits show a retry message and do not request content', async ({ page }) => {
  const state = await fixture(page); state.authRateLimited = true;
  await passwordLogin(page);
  await expect(page.getByRole('alert')).toContainText('登录次数过多，请稍后重试');
  expect(state.requests.some(request => request.pathname.includes('/rest/v1/'))).toBe(false);
});

test('idle warning preserves the draft, then signs out after 60 minutes', async ({ page }) => {
  await fixture(page);
  await page.clock.install();
  await login(page);
  await expect(page).toHaveURL(/dashboard$/);
  await page.goto('/admin/projects/new');
  await page.locator('#project-title').fill('Unsaved draft');
  await page.clock.fastForward(58 * 60 * 1000 + 1000);
  await expect(page.getByRole('alert')).toContainText('请及时保存未提交的内容');
  await expect(page.locator('#project-title')).toHaveValue('Unsaved draft');
  await page.clock.fastForward(2 * 60 * 1000);
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.getByRole('navigation', { name: '后台导航' })).toHaveCount(0);
});

test('logout clears another admin tab in the same browser even if remote logout fails', async ({ page, context }) => {
  const state = await fixture(page); await login(page);
  await expect(page).toHaveURL(/dashboard$/);
  const second = await context.newPage(); await fixture(second);
  await second.goto('/admin/projects/new');
  await expect(second.locator('#project-title')).toBeVisible();
  state.logoutError = true;
  await page.getByRole('button', { name: '退出登录', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(second).toHaveURL(/\/admin\/login$/);
});

test('idle expiry removes the editor immediately while remote sign-out is still pending', async ({ page }) => {
  await fixture(page); await page.clock.install(); await login(page);
  await expect(page).toHaveURL(/dashboard$/);
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/auth/v1/logout?**', async route => { await pending; await route.fallback(); });
  const request = page.waitForRequest(request => request.url().includes('/auth/v1/logout'));
  await page.clock.fastForward(60 * 60 * 1000 + 1000);
  await request;
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.getByRole('navigation', { name: '后台导航' })).toHaveCount(0);
  release();
});
