import { expect, test, type Page } from '@playwright/test';
import { login, passwordLogin } from './fixtures/backend';
import { accountId, accountRecord, distributionFixture, mediaId, postId, postRecord } from './fixtures/distribution';
import { createProjectDraft } from '../../src/admin/features/projects/projectForm';

const errors = new WeakMap<Page,string[]>();
test.beforeEach(async ({ page }) => {
  const messages: string[] = []; errors.set(page,messages); page.on('pageerror', error => messages.push(error.message));
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
});
test.afterEach(({ page }) => { expect(errors.get(page)).toEqual([]); });
async function open(page: Page, path = '') {
  await login(page); await expect(page).toHaveURL(/dashboard$/); await page.goto(`/admin/distribution${path}`);
}

test('overview reads real totals, recent sources and an actionable empty state', async ({ page }) => {
  const { state } = await distributionFixture(page);
  await open(page);
  await expect(page.getByTestId('distribution-accounts-total')).toHaveText('0');
  await expect(page.getByTestId('distribution-posts-drafts')).toHaveText('0');
  await expect(page.getByTestId('distribution-posts-ready')).toHaveText('0');
  await expect(page.getByRole('heading', { name: '开始准备第一份内容' })).toBeVisible();
  state.accounts.push(accountRecord(),accountRecord({ id: 'aaaaaaaa-2222-4222-8222-222222222222', is_enabled: false }),accountRecord({ id: 'aaaaaaaa-3333-4333-8333-333333333333', archived_at: '2026-11-08T00:00:00Z', is_enabled: false }));
  state.posts.push(postRecord(),postRecord({ id: 'bbbbbbbb-2222-4222-8222-222222222222', title: '等待安排', status: 'ready' }));
  await page.getByRole('button', { name: '刷新分发概览' }).click();
  await expect(page.getByTestId('distribution-accounts-total')).toHaveText('2');
  await expect(page.getByTestId('distribution-posts-drafts')).toHaveText('1');
  await expect(page.getByTestId('distribution-posts-ready')).toHaveText('1');
  await expect(page.getByRole('link', { name: /礼账的新版本/ })).toBeVisible();
});

test('missing migration and read failures never become fake zero statistics; retry recovers', async ({ page }) => {
  const { state } = await distributionFixture(page); state.missing = true;
  await open(page);
  await expect(page.getByText(/内容分发尚未启用/)).toBeVisible();
  await expect(page.getByTestId('distribution-accounts-total')).toHaveText('—');
  state.missing = false; state.readError = true;
  await page.getByRole('button', { name: '重新加载', exact: true }).click();
  await expect(page.getByText('分发数据暂时不可用')).toBeVisible();
  state.readError = false;
  await page.getByRole('button', { name: '重新加载', exact: true }).click();
  await expect(page.getByTestId('distribution-accounts-total')).toHaveText('0');
});

test('account create, edit, disable and archive preserve public projects and historical metadata', async ({ page }) => {
  const { state, backend } = await distributionFixture(page);
  backend.projects.push({ ...createProjectDraft(), id: 'project-existing', title: '礼账', slug: 'lizhang', status: 'draft' });
  await open(page,'/accounts');
  await page.getByRole('link', { name: '新增账号', exact: true }).first().click();
  await page.getByLabel('平台', { exact: true }).selectOption('bilibili');
  await page.getByLabel('账号类型').selectOption('project');
  await page.getByLabel('账号名称').fill('礼账官方');
  await page.getByLabel('主页链接').fill('https://space.bilibili.com/123');
  await page.getByLabel('账号定位').fill('分享产品功能与使用技巧');
  await page.getByLabel('备注', { exact: true }).fill('每周准备一份内容');
  await page.getByLabel('关联项目', { exact: true }).selectOption('project-existing');
  await page.getByRole('button', { name: '保存账号' }).click();
  await expect(page).toHaveURL(/accounts\/[0-9a-f-]{36}$/);
  expect(state.accounts).toHaveLength(1);
  expect(state.accounts[0]).toMatchObject({ account_type: 'project', platform: 'bilibili', project_id: 'project-existing', is_enabled: true, notes: '每周准备一份内容' });
  await page.getByLabel('账号名称').fill('礼账 · 官方账号');
  await page.getByLabel('启用账号').uncheck();
  await page.getByRole('button', { name: '保存账号' }).click();
  await expect(page.getByText('已保存。', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: '返回列表' }).click();
  await expect(page.getByText('已停用', { exact: true })).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '归档账号：礼账 · 官方账号' }).click();
  await expect(page.getByText('账号已归档。')).toBeVisible();
  expect(state.accounts[0].archived_at).toBeTruthy();
  await page.getByRole('link', { name: '查看', exact: true }).click();
  await expect(page.getByRole('button', { name: '保存账号' })).toBeDisabled();
  expect(backend.projects[0].status).toBe('draft');
  expect(backend.requests.filter(request => request.pathname.endsWith('/projects') && request.method !== 'GET')).toEqual([]);
  expect(Object.keys(state.accounts[0])).not.toContain('password');
});

test('invalid account URLs and failed saves retain input; repeated submits make one write', async ({ page }) => {
  const { state } = await distributionFixture(page);
  await open(page,'/accounts/new');
  await page.getByLabel('账号名称').fill('测试账号');
  await page.getByLabel('主页链接').fill('https://user:password@example.com');
  await page.getByRole('button', { name: '保存账号' }).click();
  await expect(page.getByText(/主页链接必须是 HTTP/)).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await page.getByLabel('主页链接').fill('https://example.com/account');
  state.writeError = true;
  await page.getByRole('button', { name: '保存账号' }).click();
  await expect(page.getByText('保存服务暂时不可用')).toBeVisible();
  await expect(page.getByLabel('账号名称')).toHaveValue('测试账号');
  state.writeError = false; state.writeDelay = 350;
  await page.getByRole('button', { name: '保存账号' }).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
  await expect(page).toHaveURL(/accounts\/[0-9a-f-]{36}$/);
  expect(state.accounts).toHaveLength(1);
  expect(state.writes).toHaveLength(2); // one failed attempt, one successful write
});

test('a lost create response uses the same UUID on retry and does not duplicate accounts', async ({ page }) => {
  const { state } = await distributionFixture(page); state.loseNextCreateResponse = true;
  await open(page,'/accounts/new'); await page.getByLabel('账号名称').fill('响应丢失');
  await page.getByRole('button', { name: '保存账号' }).click();
  await expect(page.getByText('响应丢失，请重试')).toBeVisible();
  await page.getByRole('button', { name: '保存账号' }).click();
  await expect(page.getByText(/记录已发生变化/)).toBeVisible();
  expect(state.accounts).toHaveLength(1);
  expect(state.writes[0].body.id).toBe(state.writes[1].body.id);
});

test('a lost source response reuses the UUID and leaves exactly one canonical source', async ({ page }) => {
  const { state } = await distributionFixture(page); state.loseNextCreateResponse = true;
  await open(page,'/posts/new'); await page.getByLabel('标题 *').fill('内容响应丢失');
  await page.getByRole('button', { name: '保存内容' }).click();
  await expect(page.getByText('响应丢失，请重试')).toBeVisible();
  await page.getByRole('button', { name: '保存内容' }).click();
  await expect(page.getByText(/记录已发生变化/)).toBeVisible();
  expect(state.posts).toHaveLength(1);
  expect(state.writes[0].body.p_id).toBe(state.writes[1].body.p_id);
});

test('source CRUD saves tags, project, goals, target accounts and existing media without publication', async ({ page }) => {
  const { state, backend } = await distributionFixture(page);
  state.accounts.push(accountRecord());
  backend.projects.push({ ...createProjectDraft(), id: 'project-existing', title: '礼账', slug: 'lizhang', status: 'draft' });
  backend.media.push({ id: mediaId, path: 'uploads/lizhang-cover.png' });
  await open(page,'/posts/new');
  await page.getByLabel('标题 *', { exact: true }).fill('礼账功能介绍');
  await page.getByLabel('正文', { exact: true }).fill('每一份心意，都值得好好记下。\n保留换行与 <script>示例文本</script>。');
  await page.getByLabel('标签', { exact: true }).fill('礼账， 独立开发,产品');
  await page.getByLabel('内容类型', { exact: true }).selectOption('video');
  await page.getByLabel('关联项目', { exact: true }).selectOption('project-existing');
  await page.getByLabel('推广目标', { exact: true }).selectOption('download');
  await page.getByRole('checkbox', { name: /松屿的开发手记/ }).check();
  await page.getByRole('checkbox', { name: 'lizhang-cover.png' }).check();
  await page.getByRole('button', { name: '保存内容' }).click();
  await expect(page).toHaveURL(/posts\/[0-9a-f-]{36}$/);
  expect(state.posts).toHaveLength(1);
  expect(state.posts[0]).toMatchObject({ title: '礼账功能介绍', tags: ['礼账','独立开发','产品'], project_id: 'project-existing', content_type: 'video', promotion_goal: 'download', account_ids: [accountId], media_ids: [mediaId], status: 'draft' });
  await page.getByLabel('内容状态').selectOption('ready');
  await page.getByRole('button', { name: '保存内容' }).click();
  await expect(page.getByText('已保存。', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: '返回列表' }).click();
  await expect(page.getByRole('button', { name: /^删除草稿/ })).toHaveCount(0);
  await page.getByRole('link', { name: '编辑内容：礼账功能介绍' }).click();
  await page.getByLabel('内容状态').selectOption('draft'); await page.getByRole('button', { name: '保存内容' }).click();
  await expect(page.getByText('已保存。', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: '返回列表' }).click();
  page.once('dialog', dialog => dialog.accept()); await page.getByRole('button', { name: '删除草稿：礼账功能介绍' }).click();
  await expect(page.getByText('草稿已删除。')).toBeVisible();
  expect(state.posts).toEqual([]);
  expect(backend.projects[0].status).toBe('draft');
  expect(backend.requests.some(request => /\/(projects|articles)$/.test(request.pathname) && request.method !== 'GET')).toBe(false);
});

test('source save errors, duplicate submits and stale versions preserve draft edits', async ({ page }) => {
  const { state } = await distributionFixture(page);
  await open(page,'/posts/new'); await page.getByLabel('标题 *').fill('保存重试');
  state.writeError = true; await page.getByRole('button', { name: '保存内容' }).click();
  await expect(page.getByText('保存服务暂时不可用')).toBeVisible();
  await expect(page.getByLabel('标题 *')).toHaveValue('保存重试');
  state.writeError = false; state.writeDelay = 350;
  await page.getByRole('button', { name: '保存内容' }).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
  await expect(page).toHaveURL(/posts\/[0-9a-f-]{36}$/);
  expect(state.posts).toHaveLength(1); expect(state.writes).toHaveLength(2);
  state.posts[0].version++;
  await page.getByLabel('标题 *').fill('本地编辑保留'); await page.getByRole('button', { name: '保存内容' }).click();
  await expect(page.getByText(/记录已发生变化/)).toBeVisible();
  await expect(page.getByLabel('标题 *')).toHaveValue('本地编辑保留');
  expect(state.posts[0].title).toBe('保存重试');
});

test('collection search, status, type, project, sorting and pagination survive editor return', async ({ page }) => {
  const { state, backend } = await distributionFixture(page);
  backend.projects.push({ ...createProjectDraft(), id: 'project-a', title: '礼账', slug: 'a' });
  for (let index = 1; index <= 23; index++) state.posts.push(postRecord({ id: `bbbbbbbb-1111-4111-8111-${String(index).padStart(12,'0')}`, title: `内容 ${String(index).padStart(2,'0')}`, status: 'ready', content_type: 'article', project_id: 'project-a' }));
  state.posts.push(postRecord({ title: '未匹配的草稿' }));
  await open(page,'/posts');
  await page.getByLabel('搜索分发内容', { exact: true }).fill('内容');
  await page.getByRole('group', { name: '分发内容状态筛选' }).getByRole('button', { name: /^待发布/ }).click();
  await page.getByLabel('分发内容类型').selectOption('article');
  await page.getByLabel('分发内容关联项目').selectOption('project-a');
  await page.getByLabel('分发内容排序').selectOption('title-asc');
  await expect(page.getByRole('link', { name: /^编辑内容：/ })).toHaveCount(10);
  await page.getByRole('button', { name: '下一页', exact: true }).click();
  await page.getByRole('link', { name: '编辑内容：内容 11' }).click();
  await expect(page.getByLabel('标题 *')).toHaveValue('内容 11');
  await page.getByRole('link', { name: '返回列表' }).click();
  await expect(page.getByRole('link', { name: '内容 11', exact: true })).toBeVisible();
  await expect(page.getByLabel('分发内容类型')).toHaveValue('article');
  await expect(page.getByLabel('分发内容关联项目')).toHaveValue('project-a');
  await expect(page).toHaveURL(/page=2/);
  await page.reload(); await expect(page.getByRole('link', { name: '内容 11', exact: true })).toBeVisible();
  expect(state.writes).toEqual([]);
});

test('unsaved edits show status and protect links and browser refresh; restoring baseline clears dirty', async ({ page }) => {
  await distributionFixture(page); await open(page,'/posts/new');
  const title = page.getByLabel('标题 *');
  await title.fill('未保存内容'); await expect(page.getByText('有未保存的修改')).toBeVisible();
  page.once('dialog', dialog => dialog.dismiss()); await page.getByRole('link', { name: '返回列表' }).click();
  await expect(page).toHaveURL(/posts\/new$/);
  let reloadWasBlocked = false;
  page.once('dialog', async dialog => { expect(dialog.type()).toBe('beforeunload'); reloadWasBlocked = true; await dialog.dismiss(); });
  await page.evaluate(() => window.location.reload());
  await expect.poll(() => reloadWasBlocked).toBe(true);
  await expect(title).toHaveValue('未保存内容');
  await title.fill(''); await expect(page.getByText('有未保存的修改')).toHaveCount(0);
  await page.getByRole('link', { name: '返回列表' }).click(); await expect(page).toHaveURL(/distribution\/posts$/);
});

test('editor load and reference errors can retry without creating blank or partial records', async ({ page }) => {
  const { state, backend } = await distributionFixture(page); state.posts.push(postRecord()); state.readError = true;
  await open(page,`/posts/${postId}`);
  await expect(page.getByRole('button', { name: '保存内容' })).toHaveCount(0);
  await expect(page.getByText('分发数据暂时不可用')).toBeVisible(); state.readError = false;
  await page.getByRole('button', { name: '重新加载', exact: true }).click();
  await expect(page.getByLabel('标题 *')).toHaveValue(postRecord().title);
  // Re-enter with a media request failure: the source is readable, choices are not.
  backend.mediaError = true; await page.reload();
  await expect(page.getByRole('button', { name: '保存内容' })).toBeDisabled();
  await expect(page.getByText('Media unavailable')).toBeVisible(); backend.mediaError = false;
  await page.getByRole('button', { name: '重新加载', exact: true }).click();
  await expect(page.getByRole('button', { name: '保存内容' })).toBeEnabled();
  expect(state.writes).toEqual([]);
});

test('archived/disabled accounts cannot be newly selected and existing archived links remain visible', async ({ page }) => {
  const { state } = await distributionFixture(page);
  state.accounts.push(accountRecord({ archived_at: '2026-11-08T00:00:00Z', is_enabled: false }),accountRecord({ id: 'aaaaaaaa-2222-4222-8222-222222222222', name: '停用账号', is_enabled: false }));
  state.posts.push(postRecord({ account_ids: [accountId] }));
  await open(page,`/posts/${postId}`);
  await expect(page.getByRole('checkbox', { name: /松屿的开发手记/ })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: /停用账号/ })).toBeDisabled();
  await page.getByLabel('标题 *').fill('保留旧目标'); await page.getByRole('button', { name: '保存内容' }).click();
  await expect(page.getByText('已保存。', { exact: true })).toBeVisible();
  expect(state.posts[0].account_ids).toEqual([accountId]);
});

test('leaving during a slow save does not navigate back when the mutation completes', async ({ page }) => {
  const { state } = await distributionFixture(page); state.writeDelay = 1000;
  await open(page,'/posts/new'); await page.getByLabel('标题 *').fill('异步保存');
  await page.getByRole('button', { name: '保存内容' }).click();
  await expect(page.getByLabel('标题 *')).toBeDisabled();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('navigation', { name: '内容分发导航' }).getByRole('link', { name: '矩阵账号' }).click();
  await expect(page).toHaveURL(/distribution\/accounts$/);
  await expect.poll(() => state.posts.length).toBe(1);
  await expect(page).toHaveURL(/distribution\/accounts$/);
});

test('long content fits narrow phones in both themes with tables contained inside their scroller', async ({ page }) => {
  const { state } = await distributionFixture(page);
  state.accounts.push(accountRecord({ name: '松屿内容与设计记录'.repeat(10), positioning: '长文本'.repeat(100) }));
  state.posts.push(postRecord({ title: '一份需要在小屏幕阅读和编辑的长标题'.repeat(10), body: 'LongUnbrokenContent'.repeat(150), tags: ['独立开发与产品设计'.repeat(3)] }));
  await login(page); await expect(page).toHaveURL(/dashboard$/);
  for (const width of [320,375]) {
    await page.setViewportSize({ width,height: 812 });
    for (const path of ['', '/posts','/accounts',`/posts/${postId}`]) {
      await page.goto(`/admin/distribution${path}`); await expect(page.locator('.admin-loading-content')).toHaveCount(0);
      for (const dark of [true,false]) {
        if (await page.locator('html').evaluate(root => root.classList.contains('dark')) !== dark) {
          await page.locator('.admin-theme-toggle').click(); await expect(page.locator('.theme-transition-origin')).toHaveCount(0);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
    }
  }
});

for (const context of ['anonymous','member','aal1'] as const) test(`${context} cannot open the distribution workspace or issue distribution reads`, async ({ page }) => {
  const { backend, state } = await distributionFixture(page,context === 'member' ? 'member' : 'admin');
  await page.goto('/admin/distribution/posts/new');
  await expect(page.getByLabel('管理员邮箱')).toBeVisible();
  if (context === 'member') await login(page,false);
  if (context === 'aal1') await passwordLogin(page,false);
  if (context === 'member') await expect(page.getByText('此账号没有管理员权限。')).toBeVisible();
  if (context === 'aal1') await expect(page.getByLabel('6 位验证码')).toBeVisible();
  expect(backend.requests.filter(request => request.pathname.includes('distribution'))).toEqual([]);
  expect(state.writes).toEqual([]);
});

test('desktop/mobile light/dark screens keep the existing shell, fit the viewport and render actual data', async ({ page },info) => {
  test.setTimeout(90000); // 30 rendered states and 20 full-page screenshots
  const consoleErrors: string[] = [];
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  const { state, backend } = await distributionFixture(page);
  state.accounts.push(accountRecord(),accountRecord({ id: 'aaaaaaaa-2222-4222-8222-222222222222', name: '礼账官方', platform: 'bilibili', account_type: 'project', project_id: 'project-a', positioning: '分享礼账的产品进展与实用功能' }));
  state.posts.push(postRecord({ project_id: 'project-a', account_ids: [accountId], media_ids: [mediaId] }),postRecord({ id: 'bbbbbbbb-2222-4222-8222-222222222222', title: '把每个灵感整理成下一次分享', status: 'ready', content_type: 'article', promotion_goal: 'project_visit' }));
  backend.projects.push({ ...createProjectDraft(), id: 'project-a', title: '礼账', slug: 'lizhang', status: 'draft' });
  backend.media.push({ id: mediaId, path: 'uploads/distribution-cover.webp' });
  await page.route('https://backend-v1-test.supabase.co/storage/v1/object/public/media/uploads/distribution-cover.webp', route => route.fulfill({ path: 'public/assets/work/work-project-cover-fuji.webp' }));
  await login(page); await expect(page).toHaveURL(/dashboard$/);
  for (const viewport of [{ name: 'desktop', width: 1440,height: 900 },{ name: 'compact',width: 965,height: 723 },{ name: 'mobile',width: 390,height: 844 }]) {
    await page.setViewportSize(viewport);
    for (const path of ['', '/posts','/accounts',`/posts/${postId}`,'/accounts/new']) {
      await page.goto(`/admin/distribution${path}`); await expect(page.locator('.admin-loading-content')).toHaveCount(0);
      await expect(page.locator('.distribution-tabs')).toBeVisible();
      if (!path) await expect(page.getByTestId('distribution-accounts-total')).toHaveText('2');
      if (path === `/posts/${postId}`) await expect.poll(() => page.locator('.distribution-media-option img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 1)).toBe(true);
      for (const theme of ['light','dark']) {
        if (await page.locator('html').evaluate(root => root.classList.contains('dark')) !== (theme === 'dark')) {
          await page.locator('.admin-theme-toggle:visible').click(); await expect(page.locator('.theme-transition-origin')).toHaveCount(0);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        if (viewport.name !== 'compact') {
          const name = `distribution-${viewport.name}-${path === '' ? 'overview' : path.split('/').filter(Boolean).join('-').replace(postId,'editor')}-${theme}`;
          const png = await page.screenshot({ path: `test-results/${name}.png`, fullPage: true, animations: 'disabled' });
          await info.attach(name,{ body: png,contentType: 'image/png' });
        }
      }
    }
  }
  expect(consoleErrors).toEqual([]);
});
