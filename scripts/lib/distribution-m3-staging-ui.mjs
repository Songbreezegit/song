import { readFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import { ProbeError, check, record } from './distribution-staging-target.mjs';

const preview = 'http://127.0.0.1:5199';
const calendar = '/admin/distribution/calendar';
const rpcPath = '/rest/v1/rpc/change_distribution_publish_task';

export async function runPublishUiChecks(target, publicKey, admin, fixture) {
  const previousUrl = process.env.VITE_SUPABASE_URL;
  const previousKey = process.env.VITE_SUPABASE_ANON_KEY;
  let server, browser, guardError;
  let step = 'Start isolated M3 Vite';
  const counts = { auth: 0, rest: 0, storage: 0, taskWrites: 0 };
  try {
    process.env.VITE_SUPABASE_URL = target.origin;
    process.env.VITE_SUPABASE_ANON_KEY = publicKey;
    server = await createServer({ envDir: false, server: { host: '127.0.0.1', port: 5199, strictPort: true }, logLevel: 'silent' });
    check(server.config.env.VITE_SUPABASE_URL === target.origin && server.config.env.VITE_SUPABASE_ANON_KEY === publicKey,
      'Vite uses the approved Staging project', {}, 'P1');
    await server.listen();
    step = 'Launch isolated M3 browser';
    browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true });
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 900 } });
    await context.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin === preview) return route.continue();
      if (url.origin !== target.origin || guardError) {
        if (url.hostname.endsWith('.supabase.co') && url.origin !== target.origin) {
          guardError = new ProbeError('BLOCKED', 'Browser attempted another Supabase project', {}, 'P1');
        }
        return route.abort('blockedbyclient');
      }
      try {
        await target.guardRequest(url, request.method());
        if (url.pathname === rpcPath && request.method() === 'POST') {
          const body = request.postDataJSON();
          check(body.p_action === 'create' && body.p_input.variant_id === fixture.variantId
            && body.p_input.plan_note === fixture.marker, 'Browser task write is scoped to the run fixture', {}, 'P1');
          fixture.trackRequest(body.p_request_id);
          counts.taskWrites++;
        } else {
          check(url.pathname.startsWith('/auth/v1/') || ['GET','HEAD','OPTIONS'].includes(request.method()),
            'Unexpected browser write to Staging', {}, 'P1');
        }
        const response = await route.fetch({ maxRedirects: 0, maxRetries: 0 });
        if (response.status() >= 300 && response.status() < 400 && response.status() !== 304) {
          throw new ProbeError('BLOCKED', 'Staging browser request redirected', { http: response.status() }, 'P1');
        }
        const service = url.pathname.split('/')[1];
        if (Object.hasOwn(counts, service)) counts[service]++;
        await route.fulfill({ response });
      } catch (error) {
        guardError = error instanceof ProbeError ? error : new ProbeError('BLOCKED', 'Staging browser transport failed');
        await route.abort();
      }
    });
    const page = await context.newPage();
    page.setDefaultTimeout(20_000);
    let exceptions = 0;
    page.on('pageerror', () => { exceptions++; });
    step = 'Browser real GoTrue login and TOTP';
    const path = calendar + '/new?variant=' + fixture.variantId + '&post=' + fixture.source + '&tz=UTC&date=' + fixture.date;
    await page.goto(preview + path);
    await page.getByLabel('管理员邮箱').fill(admin.email);
    await page.getByLabel('密码', { exact: true }).fill(admin.password);
    await page.getByRole('button', { name: '进入后台', exact: true }).click();
    await expect(page.getByLabel('6 位验证码')).toBeVisible();
    await page.getByLabel('6 位验证码').fill(await admin.nextCode());
    await page.getByRole('button', { name: '验证并进入后台', exact: true }).click();
    await expect(page).toHaveURL(preview + path);
    step = 'Create, reload and export a real Staging publishing task';
    await expect(page.getByRole('heading', { name: fixture.title, exact: true })).toBeVisible();
    await page.getByLabel('计划时间').fill('20:00');
    await page.getByLabel('计划备注').fill(fixture.marker);
    await page.getByRole('button', { name: '创建发布任务', exact: true }).click();
    await expect(page).toHaveURL(/\/calendar\/[0-9a-f-]{36}$/);
    const taskId = new URL(page.url()).pathname.split('/').at(-1);
    await expect(page.getByRole('heading', { level: 1, name: fixture.title })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: fixture.title })).toBeVisible();
    await expect(page.getByText('创建发布计划', { exact: true })).toBeVisible();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '导出发布资料', exact: true }).click();
    const download = await downloadPromise;
    const file = JSON.parse(await readFile(await download.path(), 'utf8'));
    check(file.publish_task_id === taskId && file.variant_id === fixture.variantId && file.title === fixture.title
      && file.variant_version === fixture.variantVersion && file.timezone === 'UTC'
      && !/access_token|refresh_token|sb_secret_|service_role/i.test(JSON.stringify(file)), 'Browser export identifies the saved task snapshot');
    await download.delete();
    await page.goto(preview + calendar + '?view=list&date=' + fixture.date + '&tz=UTC&account=' + fixture.accountId);
    await expect(page.locator('a[href="' + calendar + '/' + taskId + '"]')).toBeVisible();
    if (guardError) throw guardError;
    check(exceptions === 0 && counts.auth > 0 && counts.rest > 0 && counts.taskWrites === 1,
      'Browser created one task and performed read-only refresh, calendar and export', { exceptions, counts });
    record('PASS', 'Real M3 browser GoTrue login, create, calendar, reload, history and export', { task_id: taskId, exceptions, counts });
    return taskId;
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
