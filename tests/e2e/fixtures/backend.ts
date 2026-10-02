import type { Page } from '@playwright/test';

type Row = Record<string, any>;
const now = '2026-09-16T00:00:00Z';
const settings = () => ({ id: 'default', site_intro: 'Database introduction', based_in: 'Database city',
  currently: { text: 'Database currently', building: 'Database building', learning: 'Database learning', exploring: 'Database exploring', date: '2026.09' },
  contact: { email: 'test@example.com', github: 'https://github.com/example', x: '', bilibili: '', status: 'Database contact' },
  about: { greeting: 'Database greeting', role: 'Builder', bio: 'Database bio', location: 'Database location', whatIDo: [], techStack: [], now: [], path: [] }, updated_at: now });

// Controlled HTTP fixtures exercise the actual Supabase client and UI. SQL RLS is
// independently executed in rls.test.ts; these fixtures are not a hosted backend.
export async function fixture(page: Page, role: 'admin' | 'member' = 'admin') {
  const state = { projects: [] as Row[], articles: [] as Row[], site_settings: [settings()] as Row[], media: [] as Row[], error: false, delay: 0, membershipError: false, membershipRequests: 0, logoutError: false, mediaError: false, requests: [] as { method: string; pathname: string; search: string }[] };
  await page.route('https://backend-v1-test.supabase.co/**', async route => {
    const request = route.request(), url = new URL(request.url()), method = request.method();
    state.requests.push({ method, pathname: url.pathname, search: url.search });
    const respond = (data: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    if (url.pathname.includes('/auth/v1/')) {
      if (url.pathname.endsWith('/logout')) return state.logoutError ? respond({ message: 'Sign out unavailable' }, 500) : respond({});
      const user = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: `${role}@example.com`, app_metadata: {}, user_metadata: {}, created_at: now };
      if (url.pathname.endsWith('/user')) return respond(user);
      return respond({ access_token: 'test-access-token', refresh_token: 'test-refresh', expires_in: 3600, token_type: 'bearer', user });
    }
    if (url.pathname.includes('/storage/v1/')) {
      if (url.pathname.includes('/list/')) {
        if (state.mediaError) return respond({ message: 'Media unavailable' }, 500);
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
    if (table === 'admin_users') state.membershipRequests++;
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

export async function login(page: Page, navigate = true) {
  if (navigate) await page.goto('/admin/login');
  await page.getByLabel('管理员邮箱').fill('test@example.com');
  await page.getByLabel('密码', { exact: true }).fill('fixture-password');
  await page.getByRole('button', { name: '进入后台' }).click();
}
