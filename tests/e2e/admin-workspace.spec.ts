import { expect, test, type Page } from '@playwright/test';
import { createProjectDraft } from '../../src/admin/features/projects/projectForm';
import { createArticleDraft } from '../../src/admin/features/articles/articleForm';
import { fixture, login } from './fixtures/backend';

const runtimeErrors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const errors: string[] = [];
  runtimeErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
});
test.afterEach(({ page }) => { expect(runtimeErrors.get(page)).toEqual([]); });

async function expectQuery(page: Page, key: string, value: string | null) {
  await expect.poll(() => new URL(page.url()).searchParams.get(key)).toBe(value);
}

for (const kind of ['projects', 'articles'] as const) {
  const label = kind === 'projects' ? '项目' : '文章';
  const prefix = kind === 'projects' ? 'project' : 'article';
  const categoryField = kind === 'projects' ? 'category' : 'category_slug';
  const category = kind === 'projects' ? 'web' : 'development';
  const createDraft = kind === 'projects' ? createProjectDraft : createArticleDraft;

  test(`${kind}: filters, sort and pagination survive reload and editor return`, async ({ page }) => {
    const state = await fixture(page);
    for (let index = 1; index <= 24; index++) {
      const number = String(index).padStart(2, '0');
      state[kind].push({ ...createDraft(), id: `workspace-${number}`, title: `Workspace ${number}`, slug: `workspace-${number}`,
        [categoryField]: category, status: 'published', sort_order: 25 - index, created_at: '2026-09-01T00:00:00Z', updated_at: `2026-09-${number}T00:00:00Z` });
    }
    state[kind].push(
      { ...createDraft(), id: 'draft', title: 'Workspace draft', slug: 'workspace-draft', [categoryField]: category, status: 'draft' },
      { ...createDraft(), id: 'other-category', title: 'Workspace other category', slug: 'workspace-other', [categoryField]: 'ai', status: 'published' },
      { ...createDraft(), id: 'other-search', title: 'Elsewhere', slug: 'elsewhere', [categoryField]: category, status: 'published' },
    );
    await login(page);
    await expect(page).toHaveURL(/dashboard$/);
    await page.goto(`/admin/${kind}`);
    await page.getByLabel(`搜索${label}`, { exact: true }).fill('Workspace');
    await expectQuery(page, 'q', 'Workspace');
    await page.getByRole('group', { name: `${label}状态筛选` }).getByRole('button', { name: /^已发布/ }).click();
    await expectQuery(page, 'status', 'published');
    await page.getByLabel(`${label}分类`, { exact: true }).selectOption(category);
    await expectQuery(page, 'category', category);
    await page.getByLabel(`${label}排序`, { exact: true }).selectOption('title-asc');
    await expectQuery(page, 'sort', 'title-asc');
    await expect(page.getByTitle(`编辑${label}`, { exact: true })).toHaveCount(10);
    await expect(page.getByText('Workspace 01', { exact: true })).toBeVisible();
    await expect(page.getByText('Workspace draft', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Workspace other category', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Elsewhere', { exact: true })).toHaveCount(0);
    await page.getByRole('navigation', { name: '列表分页' }).getByRole('button', { name: '下一页', exact: true }).click();
    await expectQuery(page, 'page', '2');
    await expect(page.getByText('Workspace 11', { exact: true })).toBeVisible();
    await expect(page.getByText('Workspace 01', { exact: true })).toHaveCount(0);

    const returnUrl = page.url();
    await page.reload();
    await expect(page.getByLabel(`搜索${label}`, { exact: true })).toHaveValue('Workspace');
    await expect(page.getByLabel(`${label}分类`, { exact: true })).toHaveValue(category);
    await expect(page.getByLabel(`${label}排序`, { exact: true })).toHaveValue('title-asc');
    await expect(page.getByText('Workspace 11', { exact: true })).toBeVisible();
    await page.getByTitle(`编辑${label}`, { exact: true }).first().click();
    await expect(page.locator(`#${prefix}-title`)).toHaveValue('Workspace 11');
    await page.goBack();
    await expect(page).toHaveURL(returnUrl);
    await expect(page.getByText('Workspace 11', { exact: true })).toBeVisible();
    await page.goForward();
    await expect(page.locator(`#${prefix}-title`)).toHaveValue('Workspace 11');
    await page.getByRole('link', { name: '返回列表', exact: true }).click();
    await expect(page).toHaveURL(returnUrl);
    await expect(page.getByText('Workspace 11', { exact: true })).toBeVisible();

    await page.getByLabel(`搜索${label}`, { exact: true }).fill('no matching record');
    await expectQuery(page, 'page', null);
    await expect(page.getByTitle(`编辑${label}`, { exact: true })).toHaveCount(0);
    // Client-side collection controls never issue mutations while filtering.
    expect(state.requests.filter(request => request.pathname.endsWith(`/${kind}`) && request.method !== 'GET')).toEqual([]);
  });

  test(`${kind}: unsaved changes survive a cancelled reload and a failed save`, async ({ page }) => {
    const state = await fixture(page);
    state[kind].push({ ...createDraft(), id: 'existing', title: 'Original title', slug: 'original-title', created_at: '', updated_at: '' });
    await login(page);
    await expect(page).toHaveURL(/dashboard$/);
    await page.goto(`/admin/${kind}/existing`);
    const saveState = page.locator('.admin-editor-save-state');
    await expect(page.locator(`#${prefix}-title`)).toHaveValue('Original title');
    await expect(saveState).toHaveAttribute('data-dirty', 'false');
    await page.locator(`#${prefix}-title`).fill('Changed title');
    await expect(saveState).toHaveAttribute('data-dirty', 'true');
    await expect(saveState).toContainText('有未保存的修改');
    let reloadWasBlocked = false;
    page.once('dialog', async dialog => {
      expect(dialog.type()).toBe('beforeunload');
      reloadWasBlocked = true;
      await dialog.dismiss();
    });
    await page.evaluate(() => window.location.reload());
    await expect.poll(() => reloadWasBlocked).toBe(true);
    await expect(page.locator(`#${prefix}-title`)).toHaveValue('Changed title');
    state.error = true;
    await page.getByRole('button', { name: '保存当前状态', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('test query failure');
    await expect(saveState).toHaveAttribute('data-dirty', 'true');
    expect(state[kind][0].title).toBe('Original title');
    state.error = false;
    state.delay = 200;
    await page.getByRole('button', { name: '保存当前状态', exact: true }).click();
    await expect(page.locator(`#${prefix}-title`)).toBeDisabled();
    await expect(saveState).toContainText('正在保存');
    await expect(saveState).toHaveAttribute('data-dirty', 'false');
    await expect(saveState).toContainText('已保存于');
    expect(state[kind][0].title).toBe('Changed title');
    expect(state.requests.filter(request => request.method === 'PATCH' && request.pathname.endsWith(`/${kind}`))).toHaveLength(1);
  });
}

test('article sections retain paragraph breaks and duplicate every block independently', async ({ page }) => {
  const state = await fixture(page);
  const content = { lead: 'Lead', sections: [{ heading: 'Original section', body: ['Original paragraph'], quote: 'Original quote',
    code: { language: 'typescript', filename: 'example.ts', snippet: 'const original = true;' },
    table: { headers: ['Original header'], rows: [['Original cell']] }, callout: { type: 'tip' as const, text: 'Original tip' } }] };
  state.articles.push({ ...createArticleDraft(), id: 'structured', title: 'Structured article', slug: 'structured-article', content, created_at: '', updated_at: '' });
  await login(page);
  await expect(page).toHaveURL(/dashboard$/);
  await page.goto('/admin/articles/structured');
  const firstBody = page.locator('#article-section-0-body');
  await firstBody.fill('First paragraph');
  await firstBody.press('End');
  await firstBody.press('Enter');
  await firstBody.press('Enter');
  await firstBody.pressSequentially('Second paragraph');
  await expect(firstBody).toHaveValue('First paragraph\n\nSecond paragraph');
  await page.getByRole('button', { name: '复制小节 1', exact: true }).click();
  await expect(page.locator('#article-section-1-heading')).toHaveValue('Original section');
  await expect(page.locator('#article-section-1-body')).toHaveValue('First paragraph\n\nSecond paragraph');
  await expect(page.locator('#article-section-1-snippet')).toHaveValue('const original = true;');
  await expect(page.locator('#article-section-1-quote')).toHaveValue('Original quote');
  await expect(page.locator('#article-section-1-callout-text')).toHaveValue('Original tip');
  await page.locator('#article-section-1-heading').fill('Copied section');
  await page.locator('#article-section-1-snippet').fill('const copied = true;');
  await page.getByLabel('单元格 1, 1', { exact: true }).nth(1).fill('Copied cell');
  await expect(page.locator('#article-section-0-heading')).toHaveValue('Original section');
  await expect(page.locator('#article-section-0-snippet')).toHaveValue('const original = true;');
  await expect(page.getByLabel('单元格 1, 1', { exact: true }).first()).toHaveValue('Original cell');
  await page.getByRole('button', { name: '上移小节 2', exact: true }).click();
  await expect(page.locator('#article-section-0-heading')).toHaveValue('Copied section');
  await page.getByRole('button', { name: '保存当前状态', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('文章保存更新成功');
  expect(state.articles[0].content.sections).toHaveLength(2);
  expect(state.articles[0].content.sections[0]).toMatchObject({ heading: 'Copied section', table: { rows: [['Copied cell']] } });
  expect(state.articles[0].content.sections[1]).toMatchObject({ heading: 'Original section', body: ['First paragraph', 'Second paragraph'],
    code: { snippet: 'const original = true;' }, table: { rows: [['Original cell']] } });
  await page.reload();
  await expect(page.locator('#article-section-0-heading')).toHaveValue('Copied section');
  await expect(page.locator('#article-section-1-heading')).toHaveValue('Original section');
});

test('Chinese site sections navigate to fields and preserve ordered profile lists', async ({ page }) => {
  const state = await fixture(page);
  await login(page);
  await expect(page).toHaveURL(/dashboard$/);
  await page.goto('/admin/site');
  const navigation = page.getByRole('navigation', { name: '编辑内容分区' });
  for (const [name, field] of [['首页简介', 'site-intro'], ['近况状态', 'curr-text'], ['联系方式', 'contact-email'], ['关于我', 'about-greeting']]) {
    await navigation.getByRole('button', { name: new RegExp(name!) }).click();
    await expect(page.locator(`#${field}`)).toBeFocused();
  }
  await page.getByLabel('个人介绍', { exact: true }).fill('Updated Chinese biography');
  await page.getByRole('button', { name: '添加我在做什么条目', exact: true }).click();
  await page.getByLabel('方向名称', { exact: true }).fill('产品开发');
  await page.getByLabel('方向说明', { exact: true }).fill('从内容管理体验开始');
  await page.getByRole('button', { name: '添加技术栈条目', exact: true }).click();
  await page.getByLabel('技术分类', { exact: true }).fill('常用语言');
  await page.getByLabel('技术名称', { exact: true }).fill('TypeScript， Kotlin, React');
  await page.getByRole('button', { name: '添加经历时间线条目', exact: true }).click();
  await page.getByLabel('年份', { exact: true }).first().fill('2025');
  await page.getByLabel('经历内容', { exact: true }).first().fill('开始项目');
  await page.getByRole('button', { name: '添加经历时间线条目', exact: true }).click();
  await page.getByLabel('年份', { exact: true }).nth(1).fill('2026');
  await page.getByLabel('经历内容', { exact: true }).nth(1).fill('改进后台');
  await page.getByRole('button', { name: '上移经历时间线条目 2', exact: true }).click();
  await expect(page.getByLabel('年份', { exact: true }).first()).toHaveValue('2026');
  await expect(page.locator('.admin-editor-save-state')).toContainText('有未保存的修改');
  await page.getByRole('button', { name: '保存全站设置', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('站点设置已成功保存');
  await expect(page.locator('.admin-editor-save-state')).toHaveAttribute('data-dirty', 'false');
  expect(state.site_settings[0].about).toMatchObject({ bio: 'Updated Chinese biography',
    whatIDo: [{ title: '产品开发', desc: '从内容管理体验开始' }],
    techStack: [{ category: '常用语言', items: ['TypeScript', 'Kotlin', 'React'] }],
    path: [{ year: '2026', event: '改进后台' }, { year: '2025', event: '开始项目' }],
  });
});

test('media details expose the selected file and copy the correct public URL', async ({ page }) => {
  const state = await fixture(page);
  state.media.push({ path: 'uploads/cover-one.png' }, { path: 'projects/cover-two.webp' });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: async (value: string) => { (window as typeof window & { copiedMediaUrl?: string }).copiedMediaUrl = value; },
    } });
  });
  await login(page);
  await expect(page).toHaveURL(/dashboard$/);
  await page.goto('/admin/media');
  await expect(page.locator('.admin-media-card')).toHaveCount(2);
  await page.getByRole('button', { name: '选择图片：cover-two.webp', exact: true }).click();
  const details = page.getByLabel('图片详情', { exact: true });
  await expect(details).toContainText('cover-two.webp');
  await expect(details).toContainText('projects/cover-two.webp');
  const publicUrl = 'https://backend-v1-test.supabase.co/storage/v1/object/public/media/projects/cover-two.webp';
  await details.getByTitle('复制公开访问链接', { exact: true }).click();
  await expect(page.getByRole('status')).toContainText('已复制');
  await expect.poll(() => page.evaluate(() => (window as typeof window & { copiedMediaUrl?: string }).copiedMediaUrl)).toBe(publicUrl);
  await page.getByLabel('搜索图片', { exact: true }).fill('cover-one');
  await expect(page.locator('.admin-media-card')).toHaveCount(1);
  await expect(page.getByRole('button', { name: '选择图片：cover-one.png', exact: true })).toBeVisible();
  expect(state.requests.filter(request => request.pathname.includes('/storage/v1/') && request.method === 'DELETE')).toEqual([]);
});

test('copy failures are actionable and never report success', async ({ page }) => {
  const state = await fixture(page);
  state.media.push({ path: 'uploads/restricted.png' });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: async () => { throw new Error('Clipboard permission denied'); },
    } });
  });
  await login(page);
  await expect(page).toHaveURL(/dashboard$/);
  await page.goto('/admin/media');
  await page.getByRole('button', { name: '选择图片：restricted.png', exact: true }).click();
  await page.getByLabel('图片详情', { exact: true }).getByTitle('复制公开访问链接', { exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Clipboard permission denied');
  await expect(page.getByRole('status')).toHaveCount(0);
});

test('mobile menu traps keyboard focus, restores the opener and releases inert on desktop resize', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixture(page);
  await login(page);
  await expect(page).toHaveURL(/dashboard$/);
  // Inspect expanded state even after the desktop breakpoint hides the opener.
  // Locator clicks below still require a visible, actionable mobile control.
  const toggle = page.locator('.admin-topbar button[aria-controls="admin-sidebar"]');
  const sidebar = page.locator('#admin-sidebar');
  const first = sidebar.locator('.admin-sidebar-brand a');
  const last = sidebar.getByRole('button', { name: '退出登录', exact: true });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.admin-main')).toHaveAttribute('inert', '');
  await expect(first).toBeFocused();
  await last.focus();
  await page.keyboard.press('Tab');
  await expect(first).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(last).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle).toBeFocused();
  await toggle.click();
  await sidebar.getByRole('button', { name: '关闭菜单', exact: true }).click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle).toBeFocused();
  await toggle.click();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.admin-main')).not.toHaveAttribute('inert', '');
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
  await page.getByRole('navigation', { name: '后台导航' }).getByRole('link', { name: '项目管理', exact: true }).click();
  await expect(page.getByText('暂无项目记录。')).toBeVisible();
});

test('content workspace review screenshots show populated pages on desktop and mobile', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const state = await fixture(page);
  const cover = '/assets/work/work-project-cover-fuji.webp';
  state.projects.push(
    { ...createProjectDraft(), id: 'review-android', title: '礼账 · LizhangApp', slug: 'lizhang-app', subtitle: '让礼尚往来有迹可循', category: 'android',
      category_label: 'Android / Compose', featured: true, status: 'published', year: '2026', tech_stack: ['Kotlin', 'Compose'], cover_image: cover, created_at: '2026-09-01T00:00:00Z', updated_at: '2026-10-06T12:00:00Z' },
    { ...createProjectDraft(), id: 'review-web', title: '松屿 · SONG ISLE', slug: 'song-isle', subtitle: '持续记录作品与思考', category: 'web',
      category_label: 'Web / React', status: 'published', year: '2026', tech_stack: ['React', 'TypeScript'], cover_image: cover, created_at: '2026-09-02T00:00:00Z', updated_at: '2026-10-05T12:00:00Z' },
    { ...createProjectDraft(), id: 'review-draft', title: 'StillDue', slug: 'stilldue', subtitle: '把重要的事情放回合适的时间', category: 'android',
      category_label: 'Android / Compose', status: 'draft', year: '2026', tech_stack: ['Kotlin', 'Room'], created_at: '2026-09-03T00:00:00Z', updated_at: '2026-10-04T12:00:00Z' },
  );
  state.articles.push({ ...createArticleDraft(), id: 'review-article', title: '让内容管理更顺手', slug: 'content-management', subtitle: '从找到内容，到编辑和发布',
    category: '工程与开发', category_slug: 'development', excerpt: '清晰的工作区，让每一次整理都有明确的起点。', tags: ['产品设计', 'React'], status: 'draft',
    content: { lead: '内容管理应当围绕日常操作展开：找到要更新的记录，确认当前状态，完成编辑并保存。', sections: [
      { heading: '先找到需要处理的内容', body: ['将搜索、状态和分类放在同一处，保留列表位置。', '管理者不需要在多个页面之间反复确认。'], callout: { type: 'tip', text: '返回列表时保留筛选与页码。' } },
      { heading: '让保存结果清晰可见', body: ['为编辑器提供明确的保存状态和发布入口。'] },
    ] }, created_at: '2026-09-01T00:00:00Z', updated_at: '2026-10-06T11:00:00Z' });
  state.site_settings[0].site_intro = '在松屿，记录持续生长的作品和想法。';
  state.site_settings[0].based_in = '中国';
  state.media.push({ path: 'projects/lizhang-cover.webp' }, { path: 'projects/song-isle-cover.webp' }, { path: 'uploads/article-illustration.webp' });
  await page.route('https://backend-v1-test.supabase.co/storage/v1/object/public/media/**', route => route.fulfill({
    contentType: 'image/webp', path: 'public/assets/work/work-project-cover-fuji.webp',
  }));
  await login(page);
  await expect(page).toHaveURL(/dashboard$/);
  const destinations = [
    { name: 'dashboard', path: 'dashboard', ready: '.admin-stat-value' },
    { name: 'projects', path: 'projects', ready: '.admin-content-title' },
    { name: 'article-editor', path: 'articles/review-article', ready: '#article-title' },
    { name: 'media', path: 'media', ready: '.admin-media-card' },
  ];
  for (const destination of destinations) {
    await page.goto(`/admin/${destination.path}`);
    await expect(page.locator(destination.ready).first()).toBeVisible();
    const screenshot = await page.screenshot({ path: `test-results/admin-workspace-${destination.name}-desktop.png`, fullPage: true, animations: 'disabled' });
    await testInfo.attach(`${destination.name}-desktop`, { body: screenshot, contentType: 'image/png' });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/admin/articles/review-article');
  await expect(page.locator('#article-title')).toHaveValue('让内容管理更顺手');
  const mobileScreenshot = await page.screenshot({ path: 'test-results/admin-workspace-article-editor-mobile.png', fullPage: true, animations: 'disabled' });
  await testInfo.attach('article-editor-mobile', { body: mobileScreenshot, contentType: 'image/png' });
});

for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
  test(`management pages and editors fit a ${viewport.width}px viewport`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    const state = await fixture(page);
    const longTitle = '这是需要在小屏幕中完整管理而且能够自然换行的内容标题 '.repeat(5);
    state.projects.push({ ...createProjectDraft(), id: 'long-project', title: longTitle, slug: 'long-project',
      subtitle: 'project-subtitle-with-a-very-long-unbroken-content-value'.repeat(4), category_label: 'Android 与跨平台应用开发实践', created_at: '', updated_at: '' });
    state.articles.push({ ...createArticleDraft(), id: 'long-article', title: longTitle, slug: 'long-article',
      subtitle: 'article-subtitle-with-a-very-long-unbroken-content-value'.repeat(4), created_at: '', updated_at: '' });
    state.media.push({ path: `uploads/${'very-long-image-name-'.repeat(12)}.png` });
    await login(page);
    await expect(page).toHaveURL(/dashboard$/);
    const destinations = [
      { path: 'dashboard', ready: '.admin-stat-value' },
      { path: 'projects', ready: '.admin-content-title' },
      { path: 'articles', ready: '.admin-content-title' },
      { path: 'projects/new', ready: '#project-title' },
      { path: 'articles/new', ready: '#article-title' },
      { path: 'site', ready: '#site-intro' },
      { path: 'media', ready: '.admin-media-card' },
    ];
    for (const destination of destinations) {
      await page.goto(`/admin/${destination.path}`);
      await expect(page.locator(destination.ready).first()).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
        { message: `${destination.path} must not overflow the ${viewport.width}px viewport` }).toBeLessThanOrEqual(0);
    }
    await page.screenshot({ path: testInfo.outputPath(`admin-media-${viewport.width}.png`), fullPage: true });
  });
}

for (const kind of ['projects', 'articles'] as const) {
  for (const status of ['published', 'archived'] as const) {
    test(`${kind}: title Enter preserves ${status}, while explicit save actions change publication`, async ({ page }) => {
      const state = await fixture(page);
      const createDraft = kind === 'projects' ? createProjectDraft : createArticleDraft;
      const prefix = kind === 'projects' ? 'project' : 'article';
      state[kind].push({ ...createDraft(), id: 'keyboard-save', title: 'Original keyboard record', slug: 'keyboard-record', status, created_at: '', updated_at: '' });
      await login(page);
      await expect(page).toHaveURL(/dashboard$/);
      await page.goto(`/admin/${kind}/keyboard-save`);
      await expect(page.locator(`#${prefix}-status`)).toHaveValue(status);
      await page.locator(`#${prefix}-title`).fill(`Keyboard saved ${status}`);
      const response = page.waitForResponse(response => response.request().method() === 'PATCH' && new URL(response.url()).pathname.endsWith(`/${kind}`));
      await page.locator(`#${prefix}-title`).press('Enter');
      await response;
      await expect(page.locator('.admin-editor-save-state')).toHaveAttribute('data-dirty', 'false');
      await expect(page.locator(`#${prefix}-status`)).toHaveValue(status);
      expect(state[kind][0]).toMatchObject({ title: `Keyboard saved ${status}`, status });
      await page.getByRole('button', { name: '存为草稿', exact: true }).click();
      await expect(page.locator(`#${prefix}-status`)).toHaveValue('draft');
      expect(state[kind][0].status).toBe('draft');
      await page.getByRole('button', { name: '保存并发布', exact: true }).click();
      await expect(page.locator(`#${prefix}-status`)).toHaveValue('published');
      expect(state[kind][0].status).toBe('published');
    });
  }
}

test('the closed mobile navigation is outside the accessibility tree and keyboard tab order', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixture(page);
  await login(page);
  await expect(page).toHaveURL(/dashboard$/);
  const toggle = page.getByRole('button', { name: '切换菜单', exact: true });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('navigation', { name: '后台导航' })).toHaveCount(0);
  await toggle.focus();
  for (let index = 0; index < 8; index++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest('#admin-sidebar')))).toBe(false);
  }
  await toggle.click();
  await expect(page.getByRole('navigation', { name: '后台导航' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(toggle).toBeFocused();
  await expect(page.getByRole('navigation', { name: '后台导航' })).toHaveCount(0);
});
