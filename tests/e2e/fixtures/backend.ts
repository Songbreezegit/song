import type { Page } from '@playwright/test';

type Row = Record<string, any>;
const now = '2026-09-16T00:00:00Z';
const roles = new WeakMap<Page, 'admin' | 'member'>();
const factor = (status = 'verified') => ({ id: 'fixture-totp', factor_type: 'totp', status, friendly_name: '身份验证器', created_at: now, updated_at: now });
const jwt = (aal: string, sessionId: string) => `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: '11111111-1111-4111-8111-111111111111', aal, session_id: sessionId, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, amr: [{ method: aal === 'aal2' ? 'totp' : 'password', timestamp: Math.floor(Date.now() / 1000) }] })).toString('base64url')}.c2lnbmF0dXJl`;
const settings = () => ({ id: 'default', site_intro: 'Database introduction', based_in: 'Database city',
  currently: { text: 'Database currently', building: 'Database building', learning: 'Database learning', exploring: 'Database exploring', date: '2026.09' },
  contact: { email: 'test@example.com', github: 'https://github.com/example', x: '', bilibili: '', status: 'Database contact' },
  about: { greeting: 'Database greeting', role: 'Builder', bio: 'Database bio', location: 'Database location', whatIDo: [], techStack: [], now: [], path: [] }, updated_at: now });

// Controlled HTTP fixtures exercise the actual Supabase client and UI. SQL RLS is
// independently executed in rls.test.ts; these fixtures are not a hosted backend.
export async function fixture(page: Page, role: 'admin' | 'member' = 'admin') {
  const state = { projects: [] as Row[], articles: [] as Row[], site_settings: [settings()] as Row[], media: [] as Row[], error: false, delay: 0, membershipError: false, membershipRequests: 0, logoutError: false, mediaError: false, requests: [] as { method: string; pathname: string; search: string }[] };
  const authState = { factors: [factor()] as Row[], aal: 'aal1', mfaError: false, enrollError: false, verifyError: false, authRateLimited: false, sessionId: '33333333-3333-4333-8333-333333333333' };
  const backend = Object.assign(state, authState);
  roles.set(page, role);
  await page.route('https://backend-v1-test.supabase.co/**', async route => {
    const request = route.request(), url = new URL(request.url()), method = request.method();
    state.requests.push({ method, pathname: url.pathname, search: url.search });
    const respond = (data: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    if (url.pathname.includes('/auth/v1/')) {
      if (url.pathname.endsWith('/logout')) return state.logoutError ? respond({ message: 'Sign out unavailable' }, 500) : respond({});
      const user = () => ({ id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: `${role}@example.com`, app_metadata: {}, user_metadata: {}, created_at: now, factors: backend.factors });
      const session = () => ({ access_token: jwt(backend.aal, backend.sessionId), refresh_token: 'test-refresh', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user: user() });
      if (url.pathname.endsWith('/user')) return backend.mfaError ? respond({ message: 'MFA unavailable' }, 500) : respond(user());
      if (url.pathname.endsWith('/factors') && method === 'POST') {
        if (backend.enrollError) return respond({ message: 'Enrollment unavailable' }, 500);
        backend.factors.push(factor('unverified'));
        return respond({ id: 'fixture-totp', type: 'totp', totp: { qr_code: '<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220"><rect width="220" height="220" fill="white"/></svg>', secret: 'FIXTURESECRET', uri: 'otpauth://totp/fixture' } });
      }
      if (url.pathname.endsWith('/challenge')) return respond({ id: 'fixture-challenge', expires_at: Math.floor(Date.now() / 1000) + 300 });
      if (url.pathname.endsWith('/verify')) {
        if (backend.verifyError || request.postDataJSON().code !== '123456') return respond({ code: 'mfa_verification_failed', message: 'Invalid code' }, 422);
        backend.aal = 'aal2'; backend.factors = [factor()]; return respond(session());
      }
      if (url.pathname.includes('/factors/') && method === 'DELETE') { backend.factors = backend.factors.filter(item => item.id !== url.pathname.split('/').pop()); return respond({ id: 'fixture-totp' }); }
      if (backend.authRateLimited) return respond({ code: 'over_request_rate_limit', message: 'Rate limited' }, 429);
      if (url.searchParams.get('grant_type') === 'password') backend.aal = 'aal1';
      return respond(session());
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
  return backend;
}

export async function login(page: Page, navigate = true) {
  await passwordLogin(page, navigate);
  if (roles.get(page) === 'admin') {
    await page.getByLabel('6 位验证码').fill('123456');
    await page.getByRole('button', { name: '验证并进入后台', exact: true }).click();
  }
}

export async function passwordLogin(page: Page, navigate = true) {
  if (navigate) await page.goto('/admin/login');
  await page.getByLabel('管理员邮箱').fill('test@example.com');
  await page.getByLabel('密码', { exact: true }).fill('fixture-password');
  await page.getByRole('button', { name: '进入后台' }).click();
}
