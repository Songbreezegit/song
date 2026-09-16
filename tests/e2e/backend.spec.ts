import { test, expect, type Page } from '@playwright/test';

type Row = Record<string, any>;
const runtimeErrors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  runtimeErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
});
test.afterEach(async ({ page }) => { expect(runtimeErrors.get(page)).toEqual([]); });
const now = '2026-09-16T00:00:00Z';
const settings = () => ({ id: 'default', site_intro: 'Database introduction', based_in: 'Database city',
  currently: { text: 'Database currently', building: 'Database building', learning: 'Database learning', exploring: 'Database exploring', date: '2026.09' },
  contact: { email: 'test@example.com', github: 'https://github.com/example', x: '', bilibili: '', status: 'Database contact' },
  about: { greeting: 'Database greeting', role: 'Builder', bio: 'Database bio', location: 'Database location', whatIDo: [], techStack: [], now: [], path: [] }, updated_at: now });

// Controlled HTTP fixtures exercise the actual Supabase client and UI. SQL RLS is
// independently executed in rls.test.ts; these fixtures are not a hosted backend.
async function fixture(page: Page, role: 'admin' | 'member' = 'admin') {
  const state = { projects: [] as Row[], articles: [] as Row[], site_settings: [settings()] as Row[], media: [] as Row[], error: false, delay: 0, membershipError: false };
  await page.route('https://backend-v1-test.supabase.co/**', async route => {
    const request = route.request(), url = new URL(request.url()), method = request.method();
    const respond = (data: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    if (url.pathname.includes('/auth/v1/')) {
      if (url.pathname.endsWith('/logout')) return respond({});
      const user = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: `${role}@example.com`, app_metadata: {}, user_metadata: {}, created_at: now };
      if (url.pathname.endsWith('/user')) return respond(user);
      return respond({ access_token: 'test-access-token', refresh_token: 'test-refresh', expires_in: 3600, token_type: 'bearer', user });
    }
    if (url.pathname.includes('/storage/v1/')) {
      if (url.pathname.includes('/list/')) {
        const { prefix = '', offset = 0 } = request.postDataJSON();
        if (offset) return respond([]);
        if (!prefix) return respond([...new Set(state.media.map(m => m.path.split('/')[0]))].map(name => ({ name, id: null })));
        return respond(state.media.filter(m => m.path.startsWith(prefix + '/')).map(m => ({ id: m.path, name: m.path.slice(prefix.length + 1), created_at: now })));
      }
      if (method === 'DELETE') {
        const { prefixes } = request.postDataJSON(); state.media = state.media.filter(m => !prefixes.includes(m.path)); return respond([]);
      }
      if (method === 'POST') {
        const path = url.pathname.split('/object/media/')[1]; state.media.push({ path }); return respond({ Key: `media/${path}` });
      }
      return route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1cAAAAASUVORK5CYII=', 'base64') });
    }
    const table = url.pathname.split('/').pop()!;
    if (table === 'admin_users') return state.membershipError ? respond({ message: 'unavailable' }, 500) : respond(role === 'admin' ? { user_id: '11111111-1111-4111-8111-111111111111' } : null);
    if (state.delay) await new Promise(resolve => setTimeout(resolve, state.delay));
    if (state.error) return respond({ message: 'test query failure' }, 500);
    if (!['projects', 'articles', 'site_settings'].includes(table)) return respond([]);
    const key = table as 'projects' | 'articles' | 'site_settings';
    const matches = (row: Row) => [...url.searchParams].every(([field, filter]) => {
      if (filter.startsWith('eq.')) return String(row[field]) === filter.slice(3);
      if (filter.startsWith('neq.')) return String(row[field]) !== filter.slice(4);
      return true;
    });
    if (method === 'GET') {
      const rows = state[key].filter(matches).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      if (request.headers().accept?.includes('vnd.pgrst.object')) return respond(rows[0] || null);
      return respond(rows);
    }
    const body = request.postDataJSON();
    if (method === 'DELETE') { state[key] = state[key].filter(r => !matches(r)); return respond([]); }
    if (method === 'PATCH') {
      const row = state[key].find(matches); Object.assign(row!, body); return respond(row);
    }
    const record = Array.isArray(body) ? body[0] : body;
    const row = { id: `created-${state[key].length}`, created_at: now, updated_at: now, ...record };
    if (key === 'site_settings') state[key] = [row]; else state[key].push(row);
    return respond(row);
  });
  return state;
}

async function login(page: Page) {
  await page.goto('/admin/login');
  await page.getByLabel('管理员邮箱').fill('test@example.com');
  await page.getByLabel('密码', { exact: true }).fill('fixture-password');
  await page.getByRole('button', { name: '进入后台' }).click();
}

test('unconfigured site preserves home, navigation, and both detail types', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:5175');
  await expect(page.getByRole('button', { name: '查看项目：LizhangApp' })).toBeVisible();
  for (const name of ['Home', 'Work', 'Notes', 'About', 'Contact']) {
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
  await page.goto('/?project=lizhang');
  await expect(page.getByRole('dialog')).toContainText('未找到内容');
  await page.getByRole('button', { name: '关闭详情' }).click();
  await expect(page.locator('#work')).toContainText('暂无已发布项目');
  await expect(page.locator('#notes')).toContainText('暂无已发布笔记');
  await expect(page.getByRole('button', { name: '查看项目：LizhangApp' })).toHaveCount(0);
  await expect(page.locator('#home')).toContainText('Database introduction');
  await expect(page.locator('#about')).toContainText('Database exploring');
  state.error = true;
  await page.goto('/?note=think-before-code');
  await expect(page.getByRole('dialog')).toContainText('内容加载失败');
  await page.getByRole('button', { name: '关闭详情' }).click();
  await expect(page.locator('#work')).toContainText('内容加载失败');
  await expect(page.locator('#notes')).toContainText('内容加载失败');
  await expect(page.locator('#home')).not.toContainText('写代码，做产品');
  state.error = false; state.site_settings = []; state.delay = 1200;
  await page.goto('/');
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
      await page.getByRole('button', { name: 'Add Table' }).click();
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
      await page.goto(`/?${publicQuery}=test-${kind}`);
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
    await page.goto(`/admin/${kind}`);
    page.on('dialog', dialog => dialog.accept());
    await page.getByTitle(kind === 'projects' ? '删除项目' : '删除文章').click();
    await expect(page.getByText(kind === 'projects' ? '暂无项目记录。' : '暂无文章记录。')).toBeVisible();
    await page.goto(`/?${publicQuery}=test-${kind}`);
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
  await page.goto('/');
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
  await page.goto('/');
  await expect(page.locator('#work')).toContainText('暂无已发布项目');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.goto('http://127.0.0.1:5175');
  await page.getByRole('button', { name: '查看项目：LizhangApp' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goForward();
  await expect(page.getByRole('dialog')).toContainText('LizhangApp');
});

test('media upload/list/delete and project cover upload', async ({ page }) => {
  const state = await fixture(page); await login(page); await expect(page).toHaveURL(/dashboard$/);
  const file = { name: 'cover.png', mimeType: 'image/png', buffer: Buffer.from('test image fixture') };
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
