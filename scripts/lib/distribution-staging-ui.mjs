import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import { ProbeError, check, record } from './distribution-staging-target.mjs';

const preview = 'http://127.0.0.1:5198';

export async function runDistributionUiChecks(target, publishableKey, admin, marker, image) {
  const accountName = `${marker} UI account`;
  const title = `${marker} UI draft`;
  const body = 'Staging browser verification';
  const requests = { auth: 0, rest: 0, storage: 0 };
  const previousUrl = process.env.VITE_SUPABASE_URL;
  const previousKey = process.env.VITE_SUPABASE_ANON_KEY;
  let step = 'Start isolated Vite preview';
  let server;
  let browser;
  let guardError;
  record('NEXT', 'Scoped UI fixture names', { account: accountName, draft: title, image: image.path });
  try {
    process.env.VITE_SUPABASE_URL = target.origin;
    process.env.VITE_SUPABASE_ANON_KEY = publishableKey;
    server = await createServer({ envDir: false, server: { host: '127.0.0.1', port: 5198, strictPort: true }, logLevel: 'silent' });
    check(server.config.env.VITE_SUPABASE_URL === target.origin && server.config.env.VITE_SUPABASE_ANON_KEY === publishableKey,
      'Vite is scoped to the approved Staging origin', {}, 'P1');
    await server.listen();

    step = 'Launch browser for Staging smoke test';
    browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true });
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 900 } });
    await context.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin === preview) return route.continue();
      if (url.origin !== target.origin) {
        if (url.hostname.endsWith('.supabase.co')) guardError = new ProbeError('BLOCKED', 'Browser attempted a different Supabase project', {}, 'P1');
        return route.abort('blockedbyclient');
      }
      if (guardError) return route.abort('blockedbyclient');
      try {
        await target.guardRequest(url, request.method());
        // Forward the real upstream response, without following a redirect or synthesizing a response.
        const response = await route.fetch({ maxRedirects: 0 });
        if (response.status() >= 300 && response.status() < 400 && response.status() !== 304) {
          throw new ProbeError('BLOCKED', 'Staging response redirected in browser', { http: response.status() }, 'P1');
        }
        const service = url.pathname.split('/')[1];
        if (Object.hasOwn(requests, service)) requests[service]++;
        await route.fulfill({ response });
      } catch (error) {
        guardError = error instanceof ProbeError ? error : new ProbeError('BLOCKED', 'Browser request to Staging failed');
        await route.abort();
      }
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    let exceptions = 0;
    page.on('pageerror', () => { exceptions++; });

    step = 'Browser login and real TOTP verification';
    await page.goto(`${preview}/admin/distribution`);
    await page.getByLabel('管理员邮箱').fill(admin.email);
    await page.getByLabel('密码', { exact: true }).fill(admin.password);
    await page.getByRole('button', { name: '进入后台', exact: true }).click();
    await expect(page.getByLabel('6 位验证码')).toBeVisible({ timeout: 20000 });
    await page.getByLabel('6 位验证码').fill(await admin.nextCode());
    await page.getByRole('button', { name: '验证并进入后台', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/distribution$/, { timeout: 20000 });
    await expect(page.getByTestId('distribution-accounts-total')).toBeVisible({ timeout: 20000 });

    step = 'Create the UI matrix account';
    await page.goto(`${preview}/admin/distribution/accounts/new`);
    await page.getByLabel('平台', { exact: true }).selectOption('other');
    await page.getByLabel('账号名称').fill(accountName);
    await page.getByRole('button', { name: '保存账号' }).click();
    await expect(page).toHaveURL(/\/accounts\/[0-9a-f-]{36}$/, { timeout: 20000 });
    const accountUrl = page.url();
    const accountId = new URL(accountUrl).pathname.split('/').at(-1);

    step = 'Save UI draft with account and WebP and verify reload';
    await page.goto(`${preview}/admin/distribution/posts/new`);
    await page.getByLabel('标题 *', { exact: true }).fill(title);
    await page.getByLabel('正文', { exact: true }).fill(body);
    const account = page.getByRole('checkbox', { name: new RegExp(accountName) });
    const media = page.getByRole('checkbox', { name: image.name, exact: true });
    await account.check();
    await media.check();
    await page.getByRole('button', { name: '保存内容' }).click();
    await expect(page).toHaveURL(/\/posts\/[0-9a-f-]{36}$/, { timeout: 20000 });
    const postId = new URL(page.url()).pathname.split('/').at(-1);
    await page.reload();
    await expect(page.getByLabel('标题 *')).toHaveValue(title, { timeout: 20000 });
    await expect(account).toBeChecked();
    await expect(media).toBeChecked();

    step = 'Verify UI unsaved warning';
    const content = page.getByLabel('正文', { exact: true });
    await content.fill(`${body} unsaved`);
    await expect(page.getByText('有未保存的修改')).toBeVisible();
    await page.getByRole('link', { name: '返回列表' }).click();
    const prompt = page.getByRole('dialog', { name: '离开编辑器？' });
    await expect(prompt).toBeVisible();
    await prompt.getByRole('button', { name: '继续编辑' }).click();
    await expect(content).toHaveValue(`${body} unsaved`);
    await content.fill(body);

    step = 'Archive the UI account and verify read-only editor';
    await page.goto(`${preview}/admin/distribution/accounts`);
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: `归档账号：${accountName}`, exact: true }).click();
    await expect(page.getByText('账号已归档。')).toBeVisible({ timeout: 20000 });
    await page.goto(accountUrl);
    await expect(page.getByLabel('账号名称 *')).toBeDisabled({ timeout: 20000 });
    await expect(page.getByRole('button', { name: '保存账号' })).toBeDisabled();

    step = 'Toggle both themes and check browser exceptions';
    const theme = page.locator('.admin-theme-toggle');
    const initial = await theme.getAttribute('aria-pressed');
    await theme.click();
    await expect(theme).toHaveAttribute('aria-pressed', String(initial !== 'true'));
    await expect(page.locator('.theme-transition-origin')).toHaveCount(0);
    await theme.click();
    await expect(theme).toHaveAttribute('aria-pressed', initial);
    await expect(page.locator('.theme-transition-origin')).toHaveCount(0);
    if (guardError) throw guardError;
    check(exceptions === 0 && requests.auth > 0 && requests.rest > 0 && requests.storage > 0, step, { exceptions, requests });
    record('PASS', 'Real Staging browser smoke test', { requests, exceptions, account_id: accountId, post_id: postId });
    return { accountId, accountName, postId, title };
  } catch (error) {
    if (guardError) throw guardError;
    if (error instanceof ProbeError) throw error;
    const environment = step.startsWith('Start') || step.startsWith('Launch');
    throw new ProbeError(environment ? 'BLOCKED' : 'FAIL', step, { error_type: error.name }, environment ? undefined : 'P2');
  } finally {
    await browser?.close();
    await server?.close();
    if (previousUrl === undefined) delete process.env.VITE_SUPABASE_URL;
    else process.env.VITE_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.VITE_SUPABASE_ANON_KEY;
    else process.env.VITE_SUPABASE_ANON_KEY = previousKey;
  }
}
