import { test, expect } from '@playwright/test';
import { fixture } from './fixtures/backend';

const downloadUrl = 'https://github.com/Songbreezegit/LizhangApp/releases/download/v1.0.0/LiZhang-v1.0.0-25-release.apk';
const sourceUrl = 'https://github.com/Songbreezegit/LizhangApp.git';

for (const [language, downloadLabel, sourceLabel] of [
  ['zh', '下载 Android 版', '查看源码'],
  ['en', 'Download for Android', 'Source Code'],
  ['ja', 'Android 版をダウンロード', 'ソースコード'],
] as const) {
  test(`礼账 ${language}：从现有作品进入详情，手机端显示下载、源码及官网入口`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`http://127.0.0.1:5175/${language}/`);
    const card = page.locator('#work .project-card').filter({ hasText: 'LizhangApp' });
    await expect(card).toHaveCount(1);
    await card.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText(/1\.0\.0[（ (]+25[）)]/);
    await expect(dialog.getByRole('link', { name: downloadLabel, exact: true })).toHaveAttribute('href', downloadUrl);
    await expect(dialog.getByRole('link', { name: sourceLabel, exact: true })).toHaveAttribute('href', sourceUrl);
    const actions = dialog.locator('.detail-body > .detail-actions');
    await expect(actions).toBeVisible();
    await expect(dialog.locator('.detail-body > :first-child')).toHaveClass(/detail-actions/);
    await expect(dialog.locator('.detail-body > :nth-child(2)')).toHaveClass(/detail-lead/);
    await expect(actions.locator('a').nth(0)).toHaveAttribute('href', downloadUrl);
    await expect(actions.locator('a').nth(1)).toHaveAttribute('href', 'https://lizhang.songisle.xyz/');
    await expect(actions.locator('a').nth(2)).toHaveAttribute('href', sourceUrl);
    await expect(actions.locator('a')).toHaveCount(3);
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(dialog).not.toContainText('1.0.0-rc2');
  });
}

test('后台 UUID 项目保留唯一作品，其他作品没有礼账下载按钮', async ({ page }) => {
  const state = await fixture(page);
  state.projects.push({
    id: '0938da78-5a9a-4146-99f0-2af26548b87f', slug: 'lizhang', title: '礼账 · Lizhang',
    subtitle: '礼金记账', status: 'published', featured: true, category: 'android', category_label: 'Android',
    year: '2026', tagline: '礼账 v1.0.0', description: '正式公开发行', overview: 'v1.0.0（25），Android 8.0+',
    features: ['本地备份'], tech_stack: ['Kotlin'], development_notes: '本地保存',
    github_url: sourceUrl, live_url: 'https://lizhang.songisle.xyz/', sort_order: 1,
  });
  await page.goto('/zh/');
  await expect(page.getByRole('button', { name: '查看项目：礼账 · Lizhang', exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: '查看项目：礼账 · Lizhang', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('link', { name: '下载 Android 版', exact: true })).toHaveAttribute('href', downloadUrl);
  await page.goto('http://127.0.0.1:5175/zh/?project=online-exam');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('在线考试与评测系统');
  await expect(dialog.getByRole('link', { name: '下载 Android 版', exact: true })).toHaveCount(0);
  await expect(dialog.getByRole('link', { name: '查看源码', exact: true })).toHaveCount(1);
});
