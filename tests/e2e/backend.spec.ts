import { test, expect, type Page } from '@playwright/test';

import { fixture, login } from './fixtures/backend';
const runtimeErrors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  runtimeErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
});
test.afterEach(async ({ page }) => { expect(runtimeErrors.get(page)).toEqual([]); });
test('unconfigured site preserves home, navigation, and both detail types', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:5175/zh/');
  await expect(page.getByRole('button', { name: '查看项目：LizhangApp' })).toBeVisible();
  for (const name of ['首页', '作品', '笔记', '关于', '联系']) {
    await page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name, exact: true }).click();
  }
  await page.getByRole('button', { name: '查看项目：LizhangApp' }).click();
  await expect(page.getByRole('dialog')).toContainText('LizhangApp');
  await page.getByRole('button', { name: '关闭详情' }).click();
  await page.getByRole('button', { name: '阅读：做产品之前先想清楚问题' }).click();
  await expect(page.getByRole('dialog')).toContainText('做产品之前先想清楚问题');
  await page.getByRole('button', { name: '关闭详情' }).click();
  expect(errors).toEqual([]);
});

test('configured empty, error, loading and missing detail never restore static records', async ({ page }) => {
  const state = await fixture(page);
  await page.goto('/zh/?project=lizhang');
  await expect(page.getByRole('dialog')).toContainText('未找到内容');
  await page.getByRole('button', { name: '关闭详情' }).click();
  await expect(page.locator('#work')).toContainText('暂无已发布项目');
  await expect(page.locator('#notes')).toContainText('暂无已发布笔记');
  await expect(page.getByRole('button', { name: '查看项目：LizhangApp' })).toHaveCount(0);
  await expect(page.locator('#home')).toContainText('Database introduction');
  await expect(page.locator('#about')).toContainText('Database exploring');
  state.error = true;
  await page.goto('/zh/?note=think-before-code');
  await expect(page.getByRole('dialog')).toContainText('内容加载失败');
  await page.getByRole('button', { name: '关闭详情' }).click();
  await expect(page.locator('#work')).toContainText('内容加载失败');
  await expect(page.locator('#notes')).toContainText('内容加载失败');
  await expect(page.locator('#home')).toContainText('内容加载失败');
  state.error = false; state.site_settings = []; state.delay = 1200;
  await page.goto('/zh/');
  await expect(page.locator('#work')).toContainText('正在加载');
  await expect(page.locator('#home')).toContainText('站点信息尚未发布');
});

test('unauthenticated redirect, member denial, and membership lookup failure', async ({ page }) => {
  const state = await fixture(page, 'member');
  await page.goto('/admin'); await expect(page).toHaveURL(/\/admin\/login$/);
  await login(page); await expect(page.getByText('此账号没有管理员权限。')).toBeVisible();
  await page.goto('/admin'); await expect(page.getByRole('alert')).toContainText('此账号没有管理员权限');
  state.membershipError = true;
  await page.reload(); await expect(page.getByRole('alert')).toContainText('无法验证管理员权限');
});

for (const kind of ['projects', 'articles'] as const) {
  test(`${kind}: create, edit, sort, slug conflict, draft/publish/archive/delete visibility`, async ({ page }) => {
    const state = await fixture(page);
    await login(page); await expect(page).toHaveURL(/\/admin\/dashboard$/);
    await page.goto(`/admin/${kind}/new`);
    const prefix = kind === 'projects' ? 'project' : 'article';
    await page.locator(`#${prefix}-title`).fill(`Test ${kind}`);
    await page.locator(`#${prefix}-slug`).fill(`test-${kind}`);
    await page.getByLabel('Sort Order').fill('23');
    if (kind === 'articles') {
      await page.getByRole('button', { name: '添加小节 (Section)' }).click();
      await page.getByRole('button', { name: '添加表格' }).click();
      await page.getByRole('button', { name: '新增列', exact: true }).click();
      await page.getByRole('button', { name: '删除列 3', exact: true }).click();
      await page.getByRole('button', { name: '新增行', exact: true }).click();
      await page.getByRole('button', { name: '删除行 2', exact: true }).click();
      await page.getByLabel('表头 1', { exact: true }).fill('Header');
      await page.getByLabel('单元格 1, 1', { exact: true }).fill('Cell');
    }
    await page.getByRole('button', { name: '保存当前状态', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/${kind}/created-0$`));
    await expect(page.getByLabel('Sort Order')).toHaveValue('23');
    if (kind === 'articles') {
      await expect(page.getByLabel('表头 1', { exact: true })).toHaveValue('Header');
      await expect(page.getByLabel('单元格 1, 1', { exact: true })).toHaveValue('Cell');
    }
    const publicQuery = kind === 'projects' ? 'project' : 'note';
    for (const status of ['draft', 'published', 'archived']) {
      await page.locator(`#${prefix}-status`).selectOption(status);
      await page.getByRole('button', { name: '保存当前状态', exact: true }).click();
      await expect(page.getByText(kind === 'projects' ? '项目保存更新成功！' : '文章保存更新成功！')).toBeVisible();
      expect(state[kind][0].sort_order).toBe(23);
      await page.goto(`/zh/?${publicQuery}=test-${kind}`);
      await expect(page.getByRole('dialog')).toContainText(status === 'published' ? `Test ${kind}` : '未找到内容');
      if (status === 'published' && kind === 'articles') await expect(page.getByRole('dialog')).toContainText('Cell');
      await page.goto(`/admin/${kind}/created-0`);
      await expect(page.getByLabel('Sort Order')).toHaveValue('23');
    }
    state[kind].push({ ...state[kind][0], id: 'duplicate', slug: 'duplicate' });
    await page.locator(`#${prefix}-slug`).fill('duplicate');
    await page.getByRole('button', { name: '保存当前状态', exact: true }).click();
    await expect(page.getByText('Slug "duplicate" 已存在，请更换！')).toBeVisible();
    state[kind].pop();
    // Discard the known conflicting edit before returning to the list; the
    // editor now warns when a full document navigation has unsaved changes.
    page.on('dialog', dialog => dialog.accept());
    await page.goto(`/admin/${kind}`);
    await page.getByTitle(kind === 'projects' ? '删除项目' : '删除文章').click();
    await expect(page.getByText(kind === 'projects' ? '暂无项目记录。' : '暂无文章记录。')).toBeVisible();
    await page.goto(`/zh/?${publicQuery}=test-${kind}`);
    await expect(page.getByRole('dialog')).toContainText('未找到内容');
  });
}

test('site settings persist to every public section and empty About arrays do not crash', async ({ page }) => {
  await fixture(page); await login(page); await expect(page).toHaveURL(/dashboard$/);
  await page.goto('/admin/site');
  for (const [id, value] of Object.entries({ 'site-intro': 'Saved intro', 'based-in': 'Saved city', 'curr-text': 'Saved currently', 'curr-building': 'Saved building', 'curr-learning': 'Saved learning', 'curr-exploring': 'Saved exploring', 'contact-email': 'saved@example.com', 'about-bio': 'Saved biography' })) {
    await page.locator(`#${id}`).fill(value);
  }
  await page.getByRole('button', { name: '保存全站设置', exact: true }).click();
  await expect(page.getByText('站点设置已成功保存！')).toBeVisible();
  await page.goto('/zh/');
  await expect(page.locator('#home')).toContainText('Saved intro');
  await expect(page.locator('#home')).toContainText('Saved city');
  await expect(page.locator('#home')).toContainText('Saved currently');
  await expect(page.locator('#about')).toContainText('Saved building');
  await expect(page.locator('#about')).toContainText('Saved learning');
  await expect(page.locator('#about')).toContainText('Saved exploring');
  await expect(page.locator('#about')).toContainText('Saved biography');
  await expect(page.locator('#contact')).toContainText('saved@example.com');
});

test('mobile empty states fit viewport and detail follows browser back/forward', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixture(page);
  await page.goto('/zh/');
  await expect(page.locator('#work')).toContainText('暂无已发布项目');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.goto('http://127.0.0.1:5175/zh/');
  await page.getByRole('button', { name: '查看项目：LizhangApp' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goForward();
  await expect(page.getByRole('dialog')).toContainText('LizhangApp');
});

test('media upload/list/delete and project cover upload', async ({ page }) => {
  const state = await fixture(page); await login(page); await expect(page).toHaveURL(/dashboard$/);
  const file = { name: 'cover.png', mimeType: 'image/png', buffer: Buffer.from(await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 2; canvas.height = 2;
    return canvas.toDataURL('image/png').split(',')[1];
  }), 'base64') };
  await page.goto('/admin/media');
  await page.locator('input[type=file]').setInputFiles({ ...file, name: 'bad.gif', mimeType: 'image/gif' });
  await expect(page.getByText('不支持的文件格式。仅支持 JPG, JPEG, PNG, WEBP 格式图片。')).toBeVisible();
  await page.locator('input[type=file]').setInputFiles(file);
  await expect(page.locator('.admin-media-card')).toHaveCount(1);
  page.on('dialog', d => d.accept());
  await page.getByTitle('删除图片').click();
  await expect(page.locator('.admin-media-card')).toHaveCount(0);
  await page.goto('/admin/projects/new');
  await page.locator('#project-title').fill('Cover project');
  await page.locator('#project-slug').fill('cover-project');
  await page.locator('input[type=file]').setInputFiles(file);
  await expect(page.getByText('封面图片已上传，请保存项目以关联')).toBeVisible();
  await page.getByRole('button', { name: '保存当前状态', exact: true }).click();
  await expect(page).toHaveURL(/created-0$/);
  expect(state.projects[0].cover_image).toContain('/storage/v1/object/public/media/projects/');
});
