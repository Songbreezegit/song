import { expect, test } from '@playwright/test';
import { fixture, login, passwordLogin } from '../e2e/fixtures/backend';
import { accountId, accountRecord, distributionFixture, mediaId, postId, postRecord } from '../e2e/fixtures/distribution';

test('production public pages and MFA enrollment work under the candidate CSP', async ({ page }, info) => {
  const violations: string[] = [], errors: string[] = [];
  await page.exposeFunction('recordCspViolation', (directive: string) => violations.push(directive));
  await page.addInitScript(() => document.addEventListener('securitypolicyviolation', event => {
    (window as unknown as { recordCspViolation: (value: string) => void }).recordCspViolation(event.effectiveDirective);
  }));
  page.on('pageerror', error => errors.push(error.message));
  const state = await fixture(page); state.factors = [];
  for (const language of ['zh', 'en', 'ja']) {
    const response = await page.goto(`/${language}/`);
    const headers = response!.headers();
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers[info.project.name === 'enforced' ? 'content-security-policy' : 'content-security-policy-report-only']).toContain("script-src 'self'");
    await expect(page.locator('#home')).toBeVisible();
    await expect(page.locator('#contact')).toContainText('test@example.com');
  }
  const response = await page.goto('/admin/login');
  expect(response!.headers()['cache-control']).toBe('no-store');
  expect(response!.headers()['x-robots-tag']).toBe('noindex, nofollow');
  await passwordLogin(page, false);
  await page.getByRole('button', { name: '开始绑定' }).click();
  const qr = page.getByAltText('身份验证器绑定二维码');
  await expect(qr).toBeVisible();
  await expect.poll(() => qr.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  await page.getByLabel('6 位验证码').fill('123456');
  await page.getByRole('button', { name: '确认绑定并进入后台' }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  expect(violations).toEqual([]); expect(errors).toEqual([]);
});

test('enforced CSP blocks inline scripts; Report-Only records the violation', async ({ page }, info) => {
  await fixture(page); await page.goto('/zh/');
  await page.evaluate(() => {
    const script = document.createElement('script'); script.textContent = 'window.cspProbe = "executed"'; document.body.append(script);
  });
  const result = await page.evaluate(() => (window as unknown as { cspProbe?: string }).cspProbe);
  expect(result).toBe(info.project.name === 'enforced' ? undefined : 'executed');
});

test('the admin page cannot be embedded by another origin', async ({ page, baseURL }) => {
  const target = `${baseURL}/admin/login`;
  const response = await page.goto(target);
  expect(response!.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
  await page.route('http://127.0.0.1:5190/embed', route => route.fulfill({ contentType: 'text/html', body: `<iframe src="${target}"></iframe>` }));
  await page.goto('http://127.0.0.1:5190/embed');
  await expect.poll(() => page.frames().some(frame => frame.url().startsWith('chrome-error:'))).toBe(true);
  await expect(page.frameLocator('iframe').getByLabel('管理员邮箱')).toHaveCount(0);
});

test('distribution editor, existing media, theme and atomic save work under the production CSP', async ({ page }) => {
  const violations: string[] = [], errors: string[] = [];
  await page.exposeFunction('recordDistributionCspViolation', (directive: string) => violations.push(directive));
  await page.addInitScript(() => document.addEventListener('securitypolicyviolation', event => {
    (window as unknown as { recordDistributionCspViolation: (value: string) => void }).recordDistributionCspViolation(event.effectiveDirective);
  }));
  page.on('pageerror', error => errors.push(error.message));
  const { state, backend } = await distributionFixture(page);
  state.accounts.push(accountRecord());
  state.posts.push(postRecord({ account_ids: [accountId], media_ids: [mediaId] }));
  backend.media.push({ id: mediaId, path: 'uploads/security.png' });
  await login(page); await expect(page).toHaveURL(/dashboard$/);
  const response = await page.goto(`/admin/distribution/posts/${postId}`);
  expect(response!.headers()['cache-control']).toBe('no-store');
  await expect(page.getByLabel('标题 *')).toHaveValue(postRecord().title);
  await expect(page.getByRole('button', { name: '保存内容' })).toBeEnabled();
  await expect.poll(() => page.locator('.distribution-media-option img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  await page.locator('.admin-theme-toggle').click();
  await expect(page.locator('.theme-transition-origin')).toHaveCount(0);
  await page.getByLabel('标题 *').fill('CSP 下的分发内容');
  await page.getByRole('button', { name: '保存内容' }).click();
  await expect(page.getByText('已保存。', { exact: true })).toBeVisible();
  expect(state.posts[0].title).toBe('CSP 下的分发内容');
  expect(violations).toEqual([]); expect(errors).toEqual([]);
});
