import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { login } from './fixtures/backend';
import { accountId } from './fixtures/distribution';
import { firstVariant, variantsPath } from './fixtures/distributionVariants';
import { calendar, distributionPublishFixture, frozenTitle, history } from './fixtures/distributionPublish';

const date = '2026-11-16';
const datePath = calendar + '?date=' + date + '&tz=Asia%2FShanghai';
const schedule = '2026-11-16T12:00:00Z';
const mockNow = new Date('2026-11-13T00:00:00Z');
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
async function open(page: Page, path: string) {
  await login(page);
  await expect(page).toHaveURL(/dashboard$/);
  await page.goto(path);
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(mockNow);
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
});

test('switches calendar views and persists platform, account, state, date range and timezone in the URL', async ({ page }) => {
  const f = await distributionPublishFixture(page);
  f.seed(schedule);
  await open(page, datePath);
  await expect(page.getByRole('region', { name: '月日历' })).toBeVisible();
  await page.getByRole('button', { name: '2026-11-16，已加载 1 项任务' }).click();
  await expect(page.getByRole('link', { name: frozenTitle })).toBeVisible();
  await button(page, '周视图').click();
  await expect(page.getByRole('region', { name: '周日历' })).toBeVisible();
  await button(page, '任务列表').click();
  await page.getByLabel('平台', { exact: true }).selectOption('xiaohongshu');
  await page.getByLabel('账号', { exact: true }).selectOption(accountId);
  await page.getByLabel('任务状态', { exact: true }).selectOption('planned');
  await page.getByLabel('处理进度').selectOption('open');
  await page.getByLabel('起始日期').fill(date);
  await page.getByLabel('截止日期').fill(date);
  await page.getByLabel('日历时区').fill('Asia/Tokyo');
  await button(page, '应用时区').click();
  await expect(page.getByText('计划 2026-11-16 21:00 Asia/Tokyo (UTC+09:00)')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('账号', { exact: true })).toHaveValue(accountId);
  await expect(page.getByLabel('平台', { exact: true })).toHaveValue('xiaohongshu');
  await expect(page.getByLabel('任务状态')).toHaveValue('planned');
  await expect(page.getByRole('link', { name: frozenTitle })).toBeVisible();
  expect(f.reads.at(-1)?.getAll('scheduled_at')).toEqual(['gte.2026-11-15T15:00:00Z', 'lt.2026-11-16T15:00:00Z']);
  expect(f.writes).toEqual([]);
});

test('creates from the calendar, preserves edits on cancelled navigation, and reuses a lost response request ID', async ({ page }) => {
  const f = await distributionPublishFixture(page);
  f.flags.loseNextResponse = true;
  await open(page, datePath);
  await page.getByRole('link', { name: '安排此日' }).click();
  await page.getByRole('button', { name: '选择 ' + frozenTitle + ' 小红书个人账号' }).click();
  await expect(page.getByLabel('计划日期')).toHaveValue(date);
  await page.getByLabel('计划时间').fill('20:00');
  await page.getByLabel('计划备注').fill('手动上传并记录');
  await page.getByRole('link', { name: '发布历史' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await button(page, '继续编辑').click();
  await expect(page.getByLabel('计划备注')).toHaveValue('手动上传并记录');
  await button(page, '创建发布任务').click();
  await expect(page.getByRole('alert')).toContainText('操作失败');
  await button(page, '创建发布任务').click();
  await expect(page).toHaveURL(/calendar\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { level: 1, name: frozenTitle })).toBeVisible();
  expect(f.tasks).toHaveLength(1);
  expect(f.events).toHaveLength(1);
  expect(f.writes[0].p_request_id).toBe(f.writes[1].p_request_id);
  expect(f.tasks[0].scheduled_at).toBe('2026-11-16T12:00:00Z');
});

test('enters from a ready variant and disambiguates a repeated local time', async ({ page }) => {
  const f = await distributionPublishFixture(page);
  await open(page, variantsPath + '/' + firstVariant);
  await page.getByRole('link', { name: '安排发布' }).click();
  await expect(page.getByRole('heading', { name: frozenTitle })).toBeVisible();
  await page.getByLabel('计划日期').fill('2027-03-14');
  await page.getByLabel('计划时间').fill('02:30');
  await page.getByLabel('时区', { exact: true }).fill('America/New_York');
  await expect(page.getByText(/跳过了这段本地时间/)).toBeVisible();
  await page.getByLabel('计划日期').fill('2027-11-07');
  await page.getByLabel('计划时间').fill('01:30');
  await page.getByLabel('本地时间出现两次').selectOption('later');
  await button(page, '创建发布任务').click();
  await expect(page).toHaveURL(/calendar\/[0-9a-f-]{36}$/);
  expect(f.tasks[0]).toMatchObject({ scheduled_at: '2027-11-07T06:30:00Z', timezone: 'America/New_York' });
});

test('reads an overdue frozen snapshot, copies and exports it, and opens the platform without a task write', async ({ page, context }) => {
  const f = await distributionPublishFixture(page);
  const task = f.seed('2026-11-12T12:00:00Z');
  f.append(task, 'task_created', null);
  f.variants[0].title = '更新后的平台稿';
  f.variants[0].version = 2;
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const platformRequests: string[] = [];
  await context.route('https://example.com/song', async route => {
    platformRequests.push(route.request().method());
    await route.fulfill({ body: 'Local platform fixture' });
  });
  await open(page, calendar + '/' + task.id);
  await expect(page.getByText('已逾期', { exact: true })).toBeVisible();
  await expect(page.getByText('当前任务使用 v1，最新为 v2。')).toBeVisible();
  await page.getByText('查看平台稿版本差异', { exact: true }).click();
  await expect(page.getByText('更新后的平台稿', { exact: true })).toBeVisible();
  await button(page, '复制标题').click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(frozenTitle);
  const download = page.waitForEvent('download');
  await button(page, '导出发布资料').click();
  const file = await readFile((await (await download).path())!, 'utf8');
  expect(JSON.parse(file)).toMatchObject({ publish_task_id: task.id, title: frozenTitle, variant_version: 1 });
  const popup = page.waitForEvent('popup');
  await page.getByRole('link', { name: '打开平台账号主页' }).click();
  await (await popup).close();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: frozenTitle })).toBeVisible();
  expect(platformRequests).toEqual(['GET']);
  expect(f.writes).toEqual([]);
  expect(f.events).toHaveLength(1);
  expect(task.status).toBe('planned');
});

test('handles reschedule conflict, explicitly adopts a newer snapshot, reports and corrects with an audit timeline', async ({ page }) => {
  const f = await distributionPublishFixture(page);
  const task = f.seed(schedule);
  f.append(task, 'task_created', null);
  await open(page, calendar + '/' + task.id);
  await button(page, '调整计划').click();
  await page.getByLabel('计划时间').fill('21:00');
  await page.getByLabel('计划备注').fill('并发后保留此备注');
  task.version = 2;
  await button(page, '提交调整计划').click();
  await expect(page.getByRole('alert')).toContainText('版本已变化');
  await expect(page.getByLabel('计划备注')).toHaveValue('并发后保留此备注');
  await button(page, '重新读取任务').click();
  await button(page, '以当前任务版本继续编辑').click();
  await button(page, '提交调整计划').click();
  await expect(page.getByText('已记录调整计划。')).toBeVisible();
  expect(task.scheduled_at).toBe('2026-11-16T13:00:00Z');
  f.variants[0].version = 2;
  f.variants[0].title = '明确采用新版';
  await button(page, '重新读取任务').click();
  await button(page, '更新任务内容').click();
  await button(page, '提交更新任务内容').click();
  await expect(page.getByRole('heading', { level: 1, name: '明确采用新版' })).toBeVisible();
  await button(page, '开始人工发布').click();
  await button(page, '提交开始人工发布').click();
  await expect(page.getByText('待人工确认', { exact: true }).first()).toBeVisible();
  await button(page, '确认已人工发布').click();
  await page.getByLabel('实际发布日期').fill('2026-11-12');
  await page.getByLabel('实际发布时间').fill('20:00');
  await page.getByLabel('作品链接', { exact: true }).fill('https://example.com/work/1');
  await page.getByRole('checkbox', { name: /我确认使用/ }).check();
  await button(page, '提交确认已人工发布').click();
  await expect(page.getByText('已人工报告', { exact: true })).toBeVisible();
  await button(page, '纠正人工报告').click();
  await page.getByLabel('作品链接', { exact: true }).fill('https://example.com/work/2');
  await page.getByLabel('操作理由').fill('替换为正式作品链接');
  await page.getByRole('checkbox', { name: /我确认使用/ }).check();
  await button(page, '提交纠正人工报告').click();
  await expect(page.getByRole('link', { name: '打开作品链接' })).toHaveAttribute('href', 'https://example.com/work/2');
  await page.getByText('查看原始事件', { exact: true }).first().click();
  await expect(page.locator('.publish-event-json')).toContainText('manual_report_corrected');
  await page.goto(history + '?date=' + date + '&status=manually_reported');
  await expect(page.getByRole('link', { name: '明确采用新版' })).toBeVisible();
  expect(f.events.map(event => event.event_type)).toEqual(['task_created','task_rescheduled','task_snapshot_updated','task_started','manual_reported','manual_report_corrected']);
});

test('keeps cancelled tasks in history and recovers from read failures and empty states', async ({ page }) => {
  const f = await distributionPublishFixture(page);
  const task = f.seed(schedule);
  f.append(task, 'task_created', null);
  f.flags.readError = true;
  await open(page, datePath);
  await expect(page.getByRole('alert')).toContainText('操作失败');
  f.flags.readError = false;
  await button(page, '重新加载').click();
  await page.getByRole('link', { name: frozenTitle }).click();
  await button(page, '取消任务').click();
  await page.getByLabel('操作理由').fill('改用其他账号');
  await button(page, '提交取消任务').click();
  await expect(page.getByText('已取消', { exact: true })).toBeVisible();
  await expect(button(page, '开始人工发布')).toHaveCount(0);
  await page.goto(history + '?date=' + date + '&status=cancelled');
  await expect(page.getByRole('link', { name: frozenTitle })).toBeVisible();
  await page.getByLabel('任务状态').selectOption('planned');
  await expect(page.getByText('此范围暂无任务')).toBeVisible();
  expect(f.events.at(-1)?.metadata.reason).toBe('改用其他账号');
});

test('paginates with a stable timestamp and UUID cursor', async ({ page }) => {
  const f = await distributionPublishFixture(page);
  for (let i = 0; i < 52; i++) f.seed(schedule);
  await open(page, datePath + '&view=list');
  await expect(page.getByRole('link', { name: frozenTitle })).toHaveCount(48);
  await button(page, '加载更多任务').click();
  await expect(page.getByRole('link', { name: frozenTitle })).toHaveCount(52);
  expect(f.reads.at(-1)?.get('or')).toMatch(/scheduled_at\.gt\..*id\.gt\./);
  expect(f.writes).toEqual([]);
});

test('checks calendar and task detail at 1440, 390 and 320 in both themes', async ({ page }, info) => {
  test.setTimeout(90_000);
  const f = await distributionPublishFixture(page);
  const task = f.seed(schedule);
  f.append(task, 'task_created', null);
  f.seed('2026-11-16T13:15:00Z', 'awaiting_confirmation', f.variants[1]);
  f.seed('2026-11-21T08:00:00Z', 'cancelled');
  await open(page, datePath);
  const theme = page.locator('.admin-theme-toggle');
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const dark of [false, true]) {
      if ((await theme.getAttribute('aria-pressed')) !== String(dark)) await theme.click();
      await expect(theme).toHaveAttribute('aria-pressed', String(dark));
      await expect(page.locator('.theme-transition-origin')).toHaveCount(0);
      await expect(page.getByRole('link', { name: frozenTitle })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
      const name = 'distribution-m3-' + width + '-' + (dark ? 'dark' : 'light');
      const path = 'test-results/' + name + '.png';
      await page.screenshot({ path, fullPage: true, animations: 'disabled' });
      await info.attach(name, { path, contentType: 'image/png' });
      await page.getByRole('link', { name: frozenTitle }).click();
      await expect(page.getByRole('heading', { name: '任务内容快照' })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
      if (width === 1440) await page.screenshot({ path: 'test-results/' + name + '-task.png', fullPage: true, animations: 'disabled' });
      await page.getByRole('link', { name: '返回任务列表' }).click();
    }
  }
  expect(f.writes).toEqual([]);
});
