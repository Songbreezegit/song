import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { login } from './fixtures/backend';
import { accountId, mediaId, postId } from './fixtures/distribution';
import { distributionVariantsFixture, firstName, firstVariant, secondMedia, secondName, secondVariant, variantsPath } from './fixtures/distributionVariants';

const first = `${variantsPath}/${firstVariant}`;
const second = `${variantsPath}/${secondVariant}`;
const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const current: string[] = [];
  errors.set(page, current);
  page.on('pageerror', error => current.push(error.message));
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
});
test.afterEach(({ page }) => expect(errors.get(page)).toEqual([]));

async function open(page: Page, path = variantsPath) {
  await login(page);
  await expect(page).toHaveURL(/dashboard$/);
  await page.goto(path);
}
const title = (page: Page) => page.getByLabel('平台标题 *', { exact: true });
const body = (page: Page) => page.getByLabel('平台正文', { exact: true });
const save = (page: Page) => page.getByRole('button', { name: '保存平台稿', exact: true });
const switcher = (page: Page) => page.getByRole('navigation', { name: '切换账号平台稿' });

test('creates two independent drafts for accounts on the same platform', async ({ page }) => {
  const fixture = await distributionVariantsFixture(page, false);
  await open(page, `/admin/distribution/posts/${postId}`);
  await page.getByRole('link', { name: '平台版本', exact: true }).click();
  await page.getByRole('button', { name: `生成平台稿：${firstName}` }).click();
  await expect(title(page)).toHaveValue(fixture.source.title);
  await title(page).fill('账号 A 的独立标题');
  await page.getByLabel('标签', { exact: true }).fill('逗号,保留🌿');
  await page.getByLabel('标签', { exact: true }).press('Enter');
  await save(page).click();
  await expect(page.getByText('已保存。', { exact: true })).toBeVisible();
  await switcher(page).getByRole('link', { name: '全部目标' }).click();
  await page.getByRole('button', { name: `生成平台稿：${secondName}` }).click();
  await expect(title(page)).toHaveValue(fixture.source.title);
  await switcher(page).getByRole('link', { name: new RegExp(firstName) }).click();
  await expect(title(page)).toHaveValue('账号 A 的独立标题');
  expect(fixture.variantState.variants).toHaveLength(2);
  expect(fixture.variantState.variants.find(row => row.account_id === accountId)?.tags).toContain('逗号,保留🌿');
  expect(fixture.source.title).not.toBe('账号 A 的独立标题');
});

test('shows source changes and syncs selected fields while keeping manual content', async ({ page }) => {
  const fixture = await distributionVariantsFixture(page);
  fixture.variantState.variants[0].title = '平台稿保留这个标题';
  await open(page, `/admin/distribution/posts/${postId}`);
  await page.getByLabel('标题 *', { exact: true }).fill('新版源标题');
  await page.getByLabel('正文', { exact: true }).fill('新版源正文');
  await page.getByRole('button', { name: '保存内容', exact: true }).click();
  await expect(page.getByText('已保存。', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: '平台版本', exact: true }).click();
  await page.getByRole('link', { name: `编辑平台稿：${firstName}` }).click();
  await expect(title(page)).toHaveValue('平台稿保留这个标题');
  await expect(page.getByRole('heading', { name: '源内容已更新' })).toBeVisible();
  await page.getByText('查看变化并选择同步', { exact: true }).click();
  await expect(page.getByText('新版源标题', { exact: true })).toBeVisible();
  await page.getByRole('checkbox', { name: '同步正文', exact: true }).check();
  await page.getByRole('button', { name: '同步选中内容' }).click();
  await expect(body(page)).toHaveValue('新版源正文');
  await expect(title(page)).toHaveValue('平台稿保留这个标题');
  expect(fixture.variantState.writes.at(-1)?.input.p_fields).toEqual(['body']);
  expect(fixture.variantState.variants[0].source_version).toBe(1);
  await expect(page.getByRole('checkbox', { name: '同步正文', exact: true })).toHaveCount(0);
  await page.getByRole('checkbox', { name: '同步标题', exact: true }).check();
  await page.getByRole('button', { name: '同步选中内容' }).click();
  await expect(title(page)).toHaveValue('新版源标题');
  await expect(body(page)).toHaveValue('新版源正文');
  expect(fixture.variantState.writes.at(-1)?.input.p_fields).toEqual(['title']);
  expect(fixture.variantState.variants[0].source_version).toBe(2);
  await expect(page.getByRole('heading', { name: '源内容已更新' })).toHaveCount(0);
});

test('confirms a metadata-only source revision without editing the saved variant', async ({ page }) => {
  const fixture = await distributionVariantsFixture(page);
  const saved = { ...fixture.variantState.variants[0], status: 'ready' as const };
  fixture.variantState.variants[0].status = 'ready';
  fixture.source.promotion_goal = 'download';
  fixture.source.version = 2;
  await open(page, first);
  await expect(page.getByRole('heading', { name: '仅源版本变化' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '源内容已更新' })).toHaveCount(0);
  await page.getByRole('button', { name: '确认版本变化' }).click();
  await expect(page.getByText('已确认源版本，平台稿内容未变。')).toBeVisible();
  expect(fixture.variantState.writes).toEqual([{ name: 'retain_distribution_variant_source',
    input: { p_id: firstVariant, p_version: 1, p_source_version: 2, p_fields: [] } }]);
  expect(fixture.variantState.variants[0]).toEqual({ ...saved, source_version: 2, version: 2 });
  await page.reload();
  await expect(page.getByRole('heading', { name: '仅源版本变化' })).toHaveCount(0);
  await expect(page.getByText('已核对至内容源 v2。')).toBeVisible();
});

test('retains a selected manual field and reviews it again only after the source changes', async ({ page }) => {
  const fixture = await distributionVariantsFixture(page);
  fixture.variantState.variants[0].title = '精修标题';
  fixture.source.title = '来源标题 v2';
  fixture.source.version = 2;
  await open(page, first);
  await page.getByText('查看变化并选择同步', { exact: true }).click();
  await page.getByRole('checkbox', { name: '同步标题', exact: true }).check();
  await page.getByRole('button', { name: '保留选中字段的平台稿内容' }).click();
  await expect(page.getByText(/已选择保留平台稿内容 标题（源 v2）/)).toBeVisible();
  await page.reload();
  await expect(title(page)).toHaveValue('精修标题');
  await expect(page.getByText(/已选择保留平台稿内容 标题（源 v2）/)).toBeVisible();
  fixture.source.title = '来源标题 v3';
  fixture.source.version = 3;
  await page.getByRole('button', { name: '刷新内容源', exact: true }).click();
  await page.getByText('查看变化并选择同步', { exact: true }).click();
  await expect(page.getByText('来源标题 v3', { exact: true })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: '同步标题', exact: true })).not.toBeChecked();
  await expect(title(page)).toHaveValue('精修标题');
});

for (const competing of ['source', 'variant'] as const) test(`retains editor values and selections after a concurrent ${competing} change`, async ({ page }) => {
  const fixture = await distributionVariantsFixture(page);
  const initial = fixture.variantState.variants[0].title;
  fixture.source.title = '来源标题 v2';
  fixture.source.version = 2;
  fixture.variantState.writeDelay = 900;
  await open(page, first);
  await page.getByText('查看变化并选择同步', { exact: true }).click();
  const field = page.getByRole('checkbox', { name: '同步标题', exact: true });
  await field.check();
  await page.getByRole('button', { name: '同步选中内容' }).click();
  await expect.poll(() => fixture.variantState.writes.length).toBe(1);
  if (competing === 'source') {
    fixture.source.version++;
    fixture.source.title = '另一个会话的源标题';
  } else {
    fixture.variantState.variants[0].version++;
    fixture.variantState.variants[0].title = '另一个会话的平台稿';
  }
  await expect(page.getByRole('alert')).toContainText('平台稿、目标账号或内容源已有变化');
  await expect(title(page)).toHaveValue(initial);
  await expect(field).toBeChecked();
  await expect(page.getByText('来源标题 v2', { exact: true })).toBeVisible();
  expect(fixture.variantState.variants[0].source_version).toBe(1);
});

test('reuses the UUID when a create succeeded but its response was lost', async ({ page }) => {
  const { variantState } = await distributionVariantsFixture(page, false);
  variantState.loseNextCreateResponse = true;
  await open(page);
  const generate = page.getByRole('button', { name: `生成平台稿：${firstName}` });
  await generate.click();
  await expect(page.getByText('平台稿操作失败，请重试。')).toBeVisible();
  await generate.click();
  await expect(title(page)).toBeVisible();
  expect(variantState.writes).toHaveLength(2);
  expect(variantState.writes[1].input.p_id).toBe(variantState.writes[0].input.p_id);
  expect(variantState.variants).toHaveLength(1);
});

test('blocks ready with missing video but allows a draft to be saved', async ({ page }) => {
  const { variantState } = await distributionVariantsFixture(page);
  await open(page, first);
  await page.getByLabel('内容类型', { exact: true }).selectOption('video');
  await page.getByLabel('平台稿状态', { exact: true }).selectOption('ready');
  await save(page).click();
  await expect(page.getByRole('alert')).toContainText('仍需准备视频');
  expect(variantState.writes).toHaveLength(0);
  await page.getByLabel('平台稿状态', { exact: true }).selectOption('draft');
  await save(page).click();
  await expect(page.getByText('已保存。', { exact: true })).toBeVisible();
  expect(variantState.variants[0].status).toBe('draft');
});

test('retains the editor after failed saves and stale-version conflicts', async ({ page }) => {
  const { variantState } = await distributionVariantsFixture(page);
  await open(page, first);
  await title(page).fill('保留的本地编辑');
  variantState.writeError = true;
  await save(page).click();
  await expect(page.getByText('平台稿操作失败，请重试。')).toBeVisible();
  await expect(title(page)).toHaveValue('保留的本地编辑');
  variantState.writeError = false;
  variantState.writeDelay = 400;
  await save(page).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
  await expect(page.getByText('已保存。', { exact: true })).toBeVisible();
  expect(variantState.writes).toHaveLength(2);
  variantState.variants[0].version++;
  await title(page).fill('并发时仍保留');
  await save(page).click();
  await expect(page.getByText(/平台稿、目标账号或内容源已有变化/)).toBeVisible();
  await expect(title(page)).toHaveValue('并发时仍保留');
  expect(variantState.variants[0].title).toBe('保留的本地编辑');
});

test('protects a dirty draft when switching account and refreshing', async ({ page }) => {
  await distributionVariantsFixture(page);
  await open(page, first);
  await body(page).fill('尚未保存的平台文案');
  await switcher(page).getByRole('link', { name: new RegExp(secondName) }).click();
  const blocker = page.getByRole('dialog', { name: '离开编辑器？' });
  await expect(blocker).toBeVisible();
  await blocker.getByRole('button', { name: '继续编辑' }).click();
  await expect(body(page)).toHaveValue('尚未保存的平台文案');
  const prompt = page.waitForEvent('dialog');
  await page.evaluate(() => { setTimeout(() => window.location.reload(), 0); });
  const dialog = await prompt;
  expect(dialog.type()).toBe('beforeunload');
  await dialog.dismiss();
  await expect(body(page)).toHaveValue('尚未保存的平台文案');
  await switcher(page).getByRole('link', { name: new RegExp(secondName) }).click();
  await blocker.getByRole('button', { name: '确认离开' }).click();
  await expect(page).toHaveURL(new RegExp(second + '$'));
  await expect(body(page)).not.toHaveValue('尚未保存的平台文案');
});

test('reorders media, chooses a cover and downloads a saved snapshot', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://127.0.0.1:5174' });
  const fixture = await distributionVariantsFixture(page);
  await open(page, first);
  await page.getByRole('button', { name: '下移素材 1' }).click();
  await page.getByRole('checkbox', { name: '设为封面：second.webp' }).check();
  await page.getByLabel('素材 1 建议比例').selectOption('3:4');
  await page.getByLabel('素材 1 处理说明').fill('保留中心内容');
  await save(page).click();
  await expect(page.getByText('已保存。', { exact: true })).toBeVisible();
  const row = fixture.variantState.variants[0];
  expect(row.media.map(item => item.media_id)).toEqual([secondMedia, mediaId]);
  expect(row.media[0]).toMatchObject({ is_cover: true, processing_notes: '保留中心内容' });
  await title(page).fill('尚未保存的标题');
  await page.getByRole('button', { name: '复制标题', exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(row.title);
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出平台稿 JSON' }).click();
  const download = await downloaded;
  const payload = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(payload).toMatchObject({ title: row.title, variant_version: 2, cover_media_id: secondMedia,
    media: [{ media_id: secondMedia, still_needs_review: true }, { media_id: mediaId }] });
  expect(JSON.stringify(payload)).not.toMatch(/access_token|refresh_token|service_role/);
});

test('retries failed reads without writing or opening an empty editor', async ({ page }) => {
  const { variantState } = await distributionVariantsFixture(page);
  variantState.readError = true;
  await open(page, first);
  await expect(page.getByText('平台稿操作失败，请重试。').first()).toBeVisible();
  await expect(title(page)).toHaveCount(0);
  expect(variantState.writes).toHaveLength(0);
  variantState.readError = false;
  await page.getByRole('button', { name: '重新加载', exact: true }).click();
  await expect(title(page)).toBeVisible();
  expect(variantState.writes).toHaveLength(0);
});

test('preserves historical drafts when a target is archived or detached', async ({ page }) => {
  const fixture = await distributionVariantsFixture(page);
  fixture.source.account_ids = [accountId];
  fixture.state.accounts[0].archived_at = '2026-11-10T00:00:00Z';
  fixture.state.accounts[0].is_enabled = false;
  await open(page);
  await expect(page.getByRole('heading', { name: '历史平台稿' })).toBeVisible();
  await page.getByRole('link', { name: `查看平台稿：${firstName}` }).click();
  await expect(page.getByText('账号已归档，保留历史稿件供查阅。')).toBeVisible();
  await expect(title(page)).toBeDisabled();
  await expect(save(page)).toHaveCount(0);
  await switcher(page).getByRole('link', { name: new RegExp(secondName) }).click();
  await expect(page.getByText(/账号已从当前投放目标移除/)).toBeVisible();
  await expect(title(page)).toBeDisabled();
  await page.getByRole('link', { name: '项目管理', exact: true }).first().click();
  await expect(page).toHaveURL(/\/admin\/projects$/);
});

test('variant workspace fits 1440, 390 and 320 pixels in both themes', async ({ page }, info) => {
  test.setTimeout(75000);
  const fixture = await distributionVariantsFixture(page);
  fixture.variantState.variants[0].title = '礼账 v1.0 正式发布';
  fixture.variantState.variants[0].body = '记录每一份礼金和人情往来。\n\n为小红书个人账号准备的发布稿。';
  fixture.variantState.variants[0].media[0].is_cover = true;
  await open(page, first);
  await expect(title(page)).toBeVisible();
  const theme = page.locator('.admin-theme-toggle');
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const dark of [false, true]) {
      if ((await theme.getAttribute('aria-pressed')) !== String(dark)) await theme.click();
      await expect(theme).toHaveAttribute('aria-pressed', String(dark));
      await expect(page.locator('.theme-transition-origin')).toHaveCount(0);
      await expect(page.getByRole('heading', { name: '平台预览', exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
      const name = `distribution-m2-${width}-${dark ? 'dark' : 'light'}`;
      const path = `test-results/${name}.png`;
      await page.screenshot({ path, fullPage: true, animations: 'disabled' });
      await info.attach(name, { path, contentType: 'image/png' });
    }
  }
});
