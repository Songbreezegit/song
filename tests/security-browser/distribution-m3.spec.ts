import { expect, test } from '@playwright/test';
import { login } from '../e2e/fixtures/backend';
import { calendar, distributionPublishFixture } from '../e2e/fixtures/distributionPublish';

test('renders frozen task text literally and suppresses unsafe links without mutating under CSP', async ({ page }) => {
  const fixture = await distributionPublishFixture(page);
  fixture.variants[0].body = '<img src=x onerror=alert(1)>\n保留原稿换行';
  fixture.state.accounts[0].profile_url = 'javascript:alert(1)';
  const task = fixture.seed('2026-11-16T12:00:00Z', 'manually_reported');
  task.external_url = 'javascript:alert(1)';
  fixture.append(task, 'manual_reported', null);
  const exceptions: string[] = [];
  page.on('pageerror', error => exceptions.push(error.message));
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
  await login(page);
  await expect(page).toHaveURL(/dashboard$/);
  await page.goto(calendar + '/' + task.id);
  const snapshot = page.getByRole('region', { name: '任务内容快照' });
  await expect(snapshot.getByText('<img src=x onerror=alert(1)>', { exact: false })).toBeVisible();
  await expect(snapshot.locator('[onerror]')).toHaveCount(0);
  await expect(page.getByRole('link', { name: '打开作品链接' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: '打开平台账号主页' })).toHaveCount(0);
  await page.getByText('查看原始事件', { exact: true }).click();
  await expect(page.locator('.publish-event-json')).toContainText('manual_reported');
  await expect(page.locator('.publish-event-json img')).toHaveCount(0);
  expect(fixture.writes).toEqual([]);
  expect(exceptions).toEqual([]);
});
