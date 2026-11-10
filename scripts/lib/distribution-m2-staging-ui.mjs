import { readFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import { ProbeError, check, record } from './distribution-staging-target.mjs';

const preview = 'http://127.0.0.1:5199';

export async function runVariantUiChecks(target, publicKey, admin, fixture) {
  const previousUrl = process.env.VITE_SUPABASE_URL;
  const previousKey = process.env.VITE_SUPABASE_ANON_KEY;
  let server, browser, guardError;
  let step = 'Start isolated M2 Vite';
  const counts = { auth: 0, rest: 0, storage: 0 };
  const title = '平台稿 · 真实 Staging 浏览器';
  try {
    process.env.VITE_SUPABASE_URL = target.origin;
    process.env.VITE_SUPABASE_ANON_KEY = publicKey;
    server = await createServer({ envDir: false, server: { host: '127.0.0.1', port: 5199, strictPort: true }, logLevel: 'silent' });
    check(server.config.env.VITE_SUPABASE_URL === target.origin && server.config.env.VITE_SUPABASE_ANON_KEY === publicKey,
      'Vite is scoped to the approved Staging origin', {}, 'P1');
    await server.listen();

    step = 'Launch isolated M2 browser';
    browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true });
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 900 } });
    await context.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin === preview) return route.continue();
      if (url.origin !== target.origin || guardError) {
        if (url.origin !== target.origin && url.hostname.endsWith('.supabase.co')) guardError = new ProbeError('BLOCKED', 'Browser attempted a different Supabase project', {}, 'P1');
        return route.abort('blockedbyclient');
      }
      try {
        await target.guardRequest(url, request.method());
        const response = await route.fetch({ maxRedirects: 0 });
        if (response.status() >= 300 && response.status() < 400 && response.status() !== 304) {
          throw new ProbeError('BLOCKED', 'Staging browser request redirected', { http: response.status() }, 'P1');
        }
        const service = url.pathname.split('/')[1];
        if (Object.hasOwn(counts, service)) counts[service]++;
        await route.fulfill({ response });
      } catch (error) {
        guardError = error instanceof ProbeError ? error : new ProbeError('BLOCKED', 'Browser request to Staging failed');
        await route.abort();
      }
    });
    const page = await context.newPage();
    page.setDefaultTimeout(18000);
    let exceptions = 0;
    page.on('pageerror', () => { exceptions++; });

    step = 'Verify real browser GoTrue password and TOTP login';
    const path = '/admin/distribution/posts/' + fixture.source + '/variants';
    await page.goto(preview + path);
    await page.getByLabel('管理员邮箱').fill(admin.email);
    await page.getByLabel('密码', { exact: true }).fill(admin.password);
    await page.getByRole('button', { name: '进入后台', exact: true }).click();
    await expect(page.getByLabel('6 位验证码')).toBeVisible({ timeout: 20000 });
    await page.getByLabel('6 位验证码').fill(await admin.nextCode());
    await page.getByRole('button', { name: '验证并进入后台', exact: true }).click();
    await expect(page).toHaveURL(preview + path, { timeout: 20000 });

    step = 'Create, edit and reload a real account variant in the UI';
    await page.getByRole('button', { name: '生成平台稿：' + fixture.uiAccountName, exact: true }).click();
    const heading = page.getByLabel('平台标题 *', { exact: true });
    await expect(heading).toHaveValue(fixture.sourceTitle);
    await heading.fill(title);
    await page.getByRole('button', { name: '保存平台稿', exact: true }).click();
    await expect(page.getByText('已保存。', { exact: true })).toBeVisible();
    const variantId = new URL(page.url()).pathname.split('/').at(-1);
    await page.reload();
    await expect(heading).toHaveValue(title);

    step = 'Download the saved Staging revision';
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '导出平台稿 JSON' }).click();
    const download = await downloadPromise;
    const file = JSON.parse(await readFile(await download.path(), 'utf8'));
    check(file.variant_id === variantId && file.account.id === fixture.uiAccount
      && file.post_id === fixture.source && file.title === title && file.variant_version === 2
      && !/access_token|refresh_token|sb_secret_|service_role/i.test(JSON.stringify(file)),
    'Staging export identifies only the saved revision');
    await download.delete();
    if (guardError) throw guardError;
    check(exceptions === 0 && counts.auth > 0 && counts.rest > 0 && counts.storage > 0, 'Real Staging UI made Auth, REST and Storage requests', { exceptions, counts });
    record('PASS', 'Real M2 browser GoTrue login, variant create/save/reload/export', { variant_id: variantId, counts, exceptions });
  } catch (error) {
    if (guardError) throw guardError;
    if (error instanceof ProbeError) throw error;
    const unavailable = /^(Start|Launch)/.test(step);
    throw new ProbeError(unavailable ? 'BLOCKED' : 'FAIL', step, { error_type: error.name }, unavailable ? undefined : 'P2');
  } finally {
    await browser?.close();
    await server?.close();
    if (previousUrl === undefined) delete process.env.VITE_SUPABASE_URL;
    else process.env.VITE_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.VITE_SUPABASE_ANON_KEY;
    else process.env.VITE_SUPABASE_ANON_KEY = previousKey;
  }
}
