import { beforeEach, expect, it, vi } from 'vitest';
import { createAccountDraft, createPostDraft } from '../src/admin/features/distribution/distributionForm';

const backend = vi.hoisted(() => {
  const state = { configured: true, calls: [] as any[], respond: (_call: any): any => ({ data: [], error: null, count: 0 }) };
  const from = vi.fn((table: string) => {
    const call: any = { table, operation: 'read', filters: [], orders: [] }; state.calls.push(call);
    const query: any = {};
    for (const name of ['select','range','limit','insert','update','delete']) query[name] = vi.fn((...args: any[]) => {
      call[name] = args;
      if (['insert','update','delete'].includes(name)) call.operation = name;
      return query;
    });
    for (const name of ['eq','is']) query[name] = vi.fn((...args: any[]) => { call.filters.push([name,...args]); return query; });
    query.order = vi.fn((...args: any[]) => { call.orders.push(args); return query; });
    query.single = query.maybeSingle = vi.fn(() => Promise.resolve(state.respond(call)));
    query.then = (resolve: any, reject: any) => Promise.resolve().then(() => state.respond(call)).then(resolve, reject);
    return query;
  });
  const rpc = vi.fn((name: string, args: object) => { const call = { rpc: name, args }; state.calls.push(call); return Promise.resolve(state.respond(call)); });
  return { state, from, rpc };
});
vi.mock('../src/lib/supabase', () => ({ get isSupabaseConfigured() { return backend.state.configured; }, supabase: { from: backend.from, rpc: backend.rpc } }));

import { archiveDistributionAccount, deleteDistributionDraft, fetchDistributionAccounts, fetchDistributionOverview, fetchDistributionPosts, getDistributionPost, saveDistributionAccount, saveDistributionPost } from '../src/services/distributionService';
const id = '11111111-1111-4111-8111-111111111111';
const image = '22222222-2222-4222-8222-222222222222';

beforeEach(() => { vi.clearAllMocks(); backend.state.calls.length = 0; backend.state.configured = true; backend.state.respond = () => ({ data: [], error: null, count: 0 }); });

it('fails closed when Supabase is unconfigured or a migration is absent', async () => {
  backend.state.configured = false;
  await expect(fetchDistributionOverview()).rejects.toThrow('尚未配置');
  await expect(fetchDistributionAccounts()).rejects.toThrow('尚未配置');
  expect(backend.from).not.toHaveBeenCalled();
  backend.state.configured = true;
  backend.state.respond = () => ({ error: { code: '42P01' }, data: null });
  await expect(fetchDistributionPosts()).rejects.toThrow('先审查并批准');
});

it('loads all library pages and preserves ordered media and account references', async () => {
  const row = { ...createPostDraft(), id, distribution_post_targets: [{ account_id: image },{ account_id: id }], distribution_post_media: [{ media_id: image, sort_order: 1 },{ media_id: id, sort_order: 0 }] };
  backend.state.respond = call => ({ data: call.range?.[0] === 0 ? Array.from({ length: 500 }, () => row) : [row], error: null });
  const rows = await fetchDistributionPosts();
  expect(rows).toHaveLength(501);
  expect(rows[0]).toMatchObject({ account_ids: [id,image], media_ids: [id,image] });
  expect(backend.state.calls.map(call => call.range)).toEqual([[0,499],[500,999]]);
  expect(rows[0]).not.toHaveProperty('distribution_post_targets');
});

it('uses exact counts rather than the library length and excludes archived accounts', async () => {
  backend.state.respond = call => ({ error: null, count: call.table === 'distribution_accounts' ? 1234 : call.filters.some((filter: string[]) => filter[2] === 'draft') ? 777 : 888, data: [] });
  expect(await fetchDistributionOverview()).toEqual({ accounts: 1234, drafts: 777, ready: 888, recent: [] });
  expect(backend.state.calls[0].filters).toContainEqual(['is','archived_at',null]);
  expect(backend.state.calls[0].select).toEqual(['id',{ head: true, count: 'exact' }]);
  expect(backend.state.calls[3].limit).toEqual([6]);
});

it('never displays partial or failed statistics as real zeroes', async () => {
  backend.state.respond = call => call.table === 'distribution_accounts' ? { data: null, count: null, error: { message: 'offline' } } : { data: [], count: 0, error: null };
  await expect(fetchDistributionOverview()).rejects.toThrow('offline');
  backend.state.respond = () => ({ data: [], count: null, error: null });
  await expect(fetchDistributionOverview()).rejects.toThrow('完整统计');
});

it('account create/update/archive and draft deletion only write to distribution tables with version guards', async () => {
  backend.state.respond = () => ({ data: { id, version: 2 }, error: null });
  const input = { ...createAccountDraft(), name: '松屿' };
  await saveDistributionAccount(id, input, null);
  expect(backend.state.calls[0].insert[0]).toEqual({ id,...input });
  await saveDistributionAccount(id, input, 1);
  expect(backend.state.calls[1].filters).toEqual([['eq','id',id],['eq','version',1],['is','archived_at',null]]);
  await archiveDistributionAccount(id, 2);
  expect(backend.state.calls[2].update[0]).toMatchObject({ is_enabled: false });
  expect(backend.state.calls[2].update[0].archived_at).toMatch(/^\d{4}-/);
  await deleteDistributionDraft(id, 3);
  expect(backend.state.calls[3].filters).toEqual([['eq','id',id],['eq','version',3],['eq','status','draft']]);
  expect(backend.state.calls.every(call => ['distribution_accounts','distribution_posts'].includes(call.table))).toBe(true);
});

it('saves the source and relations through one atomic RPC without public content mutations', async () => {
  const input = { ...createPostDraft(), title: '原稿', account_ids: [id], media_ids: [image] };
  backend.state.respond = () => ({ data: { ...input, id, version: 1 }, error: null });
  expect(await saveDistributionPost(id, input, null)).toMatchObject({ id, version: 1 });
  const { account_ids, media_ids, ...payload } = input;
  expect(backend.rpc).toHaveBeenCalledExactlyOnceWith('save_distribution_post', { p_id: id, p_version: null, p_post: payload, p_account_ids: account_ids, p_media_ids: media_ids });
  expect(backend.from).not.toHaveBeenCalled();
});

it('validates before touching the database and maps conflict, relation and MFA failures', async () => {
  await expect(saveDistributionAccount(id, { ...createAccountDraft(), name: 'x', profile_url: 'javascript:alert(1)' }, null)).rejects.toThrow('HTTP');
  await expect(saveDistributionPost(id, { ...createPostDraft(), title: 'x', status: 'published' as 'draft' }, 1)).rejects.toThrow('状态');
  expect(backend.state.calls).toEqual([]);
  for (const [code, message] of [['40001','已发生变化'],['23503','关联项目'],['42501','MFA']]) {
    backend.state.respond = () => ({ data: null, error: { code } });
    await expect(saveDistributionPost(id, { ...createPostDraft(), title: 'x' }, 1)).rejects.toThrow(message);
  }
});

it('supports not-found reads and propagates network rejections without inventing records', async () => {
  backend.state.respond = () => ({ data: null, error: null });
  expect(await getDistributionPost(id)).toBeNull();
  backend.state.respond = () => { throw new Error('network'); };
  await expect(fetchDistributionAccounts()).rejects.toThrow('network');
});
