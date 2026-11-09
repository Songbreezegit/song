import type { Page } from '@playwright/test';
import { fixture } from './backend';
import { createAccountDraft, createPostDraft } from '../../../src/admin/features/distribution/distributionForm';

export const accountId = 'aaaaaaaa-1111-4111-8111-111111111111';
export const postId = 'bbbbbbbb-1111-4111-8111-111111111111';
export const mediaId = 'cccccccc-1111-4111-8111-111111111111';
const now = '2026-11-09T00:00:00Z';
type Row = Record<string, any>;
export const accountRecord = (fields: Row = {}) => ({ ...createAccountDraft(), id: accountId, name: '松屿的开发手记', platform: 'xiaohongshu', profile_url: 'https://example.com/song', positioning: '分享独立开发过程与产品设计', archived_at: null, version: 1, created_at: now, updated_at: now, ...fields });
export const postRecord = (fields: Row = {}) => ({ ...createPostDraft(), id: postId, title: '礼账的新版本，记录每一份心意', body: '从一笔礼金到一次重逢，分享礼账的开发进展与设计细节。', tags: ['独立开发','产品记录'], version: 1, created_at: now, updated_at: now, ...fields });

// Browser transport fixture only. The independent PGlite suite executes actual
// migration, RLS, invoker RPC, FK and concurrency behavior in PostgreSQL.
export async function distributionFixture(page: Page, role: 'admin' | 'member' = 'admin') {
  const backend = await fixture(page, role);
  const state = { accounts: [] as Row[], posts: [] as Row[], missing: false, readError: false, writeError: false, delay: 0, writeDelay: 0, loseNextCreateResponse: false,
    writes: [] as { table: string; method: string; body: Row }[] };
  await page.route('https://backend-v1-test.supabase.co/**', async route => {
    const request = route.request(), url = new URL(request.url()), method = request.method();
    const table = url.pathname.split('/').pop()!;
    if (url.pathname.includes('/storage/v1/object/list/') && backend.media.some(item => item.id)) {
      const { prefix = '', offset = 0 } = request.postDataJSON();
      if (backend.mediaError) return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Media unavailable' }) });
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(offset ? [] : !prefix ? [{ name: 'uploads', id: null }] : backend.media.filter(item => item.path.startsWith(prefix + '/')).map(item => ({ id: item.id, name: item.path.slice(prefix.length + 1), created_at: now }))) });
    }
    if (!['distribution_accounts','distribution_posts','save_distribution_post'].includes(table)) return route.fallback();
    backend.requests.push({ method, pathname: url.pathname, search: url.search });
    const respond = (data: unknown, status = 200, headers: Record<string,string> = {}) => route.fulfill({ status, headers, contentType: 'application/json', body: method === 'HEAD' ? '' : JSON.stringify(data) });
    const failure = (code: string, message: string, status = 400) => respond({ code, message }, status);
    if (role !== 'admin' || backend.aal !== 'aal2') return failure('42501','MFA required',403);
    if (state.missing) return failure(table === 'save_distribution_post' ? 'PGRST202' : '42P01', 'Migration missing',404);
    if (['GET','HEAD'].includes(method)) {
      if (state.delay) await new Promise(resolve => setTimeout(resolve,state.delay));
      if (state.readError) return failure('XX000','分发数据暂时不可用',500);
    } else {
      if (state.writeDelay) await new Promise(resolve => setTimeout(resolve,state.writeDelay));
      const body = request.postDataJSON(); state.writes.push({ table, method, body });
      if (state.writeError) return failure('XX000','保存服务暂时不可用',500);
      if (table === 'save_distribution_post') {
        const existing = state.posts.find(post => post.id === body.p_id);
        if (body.p_version === null && existing) return failure('23505','Duplicate id');
        if (body.p_version !== null && (!existing || existing.version !== body.p_version)) return failure('PT409','Version conflict',409);
        if (body.p_account_ids.some((id: string) => !state.accounts.some(account => account.id === id)) || body.p_media_ids.some((id: string) => !backend.media.some(item => item.id === id))) return failure('23503','Missing relation');
        const row = { id: body.p_id, ...body.p_post, account_ids: body.p_account_ids, media_ids: body.p_media_ids, version: (existing?.version || 0) + 1, created_at: existing?.created_at || now, updated_at: now };
        if (existing) Object.assign(existing,row); else state.posts.push(row);
        if (state.loseNextCreateResponse) { state.loseNextCreateResponse = false; return failure('XX000','响应丢失，请重试',500); }
        return respond(row);
      }
    }
    const rows = table === 'distribution_accounts' ? state.accounts : state.posts;
    const matches = (row: Row) => [...url.searchParams].every(([key, value]) => value.startsWith('eq.') ? String(row[key]) === value.slice(3) : value === 'is.null' ? row[key] === null : true);
    const expand = (row: Row) => table === 'distribution_accounts' ? row : { ...row, distribution_post_targets: row.account_ids.map((account_id: string) => ({ account_id })), distribution_post_media: row.media_ids.map((media_id: string, sort_order: number) => ({ media_id, sort_order })) };
    if (method === 'HEAD') return respond(null,200,{ 'content-range': `*/${rows.filter(matches).length}`, 'access-control-expose-headers': 'content-range' });
    if (method === 'GET') {
      const filtered = rows.filter(matches).sort((a,b) => b.updated_at.localeCompare(a.updated_at) || a.id.localeCompare(b.id));
      if (request.headers().accept?.includes('vnd.pgrst.object')) return respond(filtered[0] ? expand(filtered[0]) : null);
      const offset = Number(url.searchParams.get('offset') || 0), limit = Number(url.searchParams.get('limit') || filtered.length);
      return respond(filtered.slice(offset,offset+limit).map(expand));
    }
    if (method === 'DELETE') {
      const index = rows.findIndex(matches);
      if (index < 0 || rows[index].status !== 'draft') return failure('PGRST116','No rows');
      const [removed] = rows.splice(index,1); return respond({ id: removed.id });
    }
    const body = request.postDataJSON();
    if (method === 'PATCH') {
      const row = rows.find(matches); if (!row) return failure('PGRST116','No rows');
      Object.assign(row,body,{ version: row.version+1, updated_at: now }); return respond(row);
    }
    if (rows.some(row => row.id === body.id)) return failure('23505','Duplicate id');
    const row = { ...body, created_at: now, updated_at: now, archived_at: null, version: 1 };
    rows.push(row);
    if (state.loseNextCreateResponse) { state.loseNextCreateResponse = false; return failure('XX000','响应丢失，请重试',500); }
    return respond(row);
  });
  return { ...state, backend, state };
}
