import { beforeEach, describe, expect, it, vi } from 'vitest';

const backend = vi.hoisted(() => {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ['select', 'eq', 'order', 'neq', 'insert', 'update', 'delete', 'upsert']) query[method] = vi.fn(() => query);
  query.then = vi.fn();
  query.maybeSingle = vi.fn();
  query.single = vi.fn();
  const storage = { upload: vi.fn(), list: vi.fn(), remove: vi.fn(), getPublicUrl: vi.fn((path: string) => ({ data: { publicUrl: `https://test.invalid/media/${path}` } })) };
  return { configured: true, query, from: vi.fn(() => query), storage };
});
vi.mock('../src/lib/supabase', () => ({
  get isSupabaseConfigured() { return backend.configured; },
  supabase: { from: backend.from, storage: { from: () => backend.storage } },
}));

import { fetchPublishedProjects, createProject } from '../src/services/projectService';
import { fetchPublishedArticles } from '../src/services/articleService';
import { fetchSiteSettings } from '../src/services/siteService';
import { verifyAdmin } from '../src/services/adminService';
import { uploadMedia, listMedia } from '../src/services/mediaService';
import { PROJECTS, ARTICLES } from '../src/data/portfolioData';
import type { ProjectRecord } from '../src/types/database';

beforeEach(() => {
  vi.clearAllMocks();
  backend.configured = true;
  backend.query.then.mockImplementation(resolve => Promise.resolve({ data: [], error: null }).then(resolve));
  backend.query.maybeSingle.mockResolvedValue({ data: null, error: null });
});

describe('configured public data never revives static content', () => {
  it('returns empty published lists and missing settings', async () => {
    expect(await fetchPublishedProjects()).toEqual([]);
    expect(await fetchPublishedArticles()).toEqual([]);
    expect(await fetchSiteSettings()).toBeNull();
    expect(backend.query.eq).toHaveBeenCalledWith('status', 'published');
    expect(backend.query.order).toHaveBeenCalledWith('sort_order', { ascending: true });
    expect(backend.query.order).toHaveBeenCalledWith('created_at', { ascending: false });
  });
  it('propagates query errors and network rejection', async () => {
    const failure = new Error('offline');
    backend.query.then.mockImplementation(resolve => Promise.resolve({ data: null, error: failure }).then(resolve));
    backend.query.maybeSingle.mockRejectedValue(failure);
    await expect(fetchPublishedProjects()).rejects.toThrow('offline');
    await expect(fetchPublishedArticles()).rejects.toThrow('offline');
    await expect(fetchSiteSettings()).rejects.toThrow('offline');
  });
  it('uses local data only when unconfigured', async () => {
    backend.configured = false;
    expect(await fetchPublishedProjects()).toBe(PROJECTS);
    expect(await fetchPublishedArticles()).toBe(ARTICLES);
    expect((await fetchSiteSettings())?.site_intro).toBeTruthy();
    expect(backend.from).not.toHaveBeenCalled();
  });
  it('normalizes empty JSON settings without static values', async () => {
    backend.query.maybeSingle.mockResolvedValue({ data: { id: 'default', currently: {}, contact: {}, about: {} }, error: null });
    const data = await fetchSiteSettings();
    expect(data?.about.now).toEqual([]);
    expect(data?.currently.building).toBe('');
  });
});

it('requires admin membership and fails closed on errors', async () => {
  expect(await verifyAdmin('user')).toBe(false);
  backend.query.maybeSingle.mockResolvedValue({ data: { user_id: 'user' }, error: null });
  expect(await verifyAdmin('user')).toBe(true);
  backend.query.maybeSingle.mockResolvedValue({ data: null, error: { message: 'denied' } });
  await expect(verifyAdmin('user')).rejects.toThrow('无法验证');
});

it('reports duplicate slug even when a concurrent insert wins after precheck', async () => {
  backend.query.single.mockResolvedValue({ error: { code: '23505' }, data: null });
  await expect(createProject({ slug: 'duplicate', status: 'draft' } as ProjectRecord)).rejects.toThrow('Slug 已存在');
});

describe('media validation and listing', () => {
  it('rejects GIF and files over 5MB before upload', async () => {
    await expect(uploadMedia(new File(['gif'], 'bad.gif', { type: 'image/gif' }))).rejects.toThrow('JPG');
    await expect(uploadMedia(new File(['png'], 'bad.gif', { type: 'image/png' }))).rejects.toThrow('JPG');
    await expect(uploadMedia(new File([new Uint8Array(5242881)], 'large.png', { type: 'image/png' }))).rejects.toThrow('5MB');
    expect(backend.storage.upload).not.toHaveBeenCalled();
  });
  it.each([['jpg', 'image/jpeg'], ['jpeg', 'image/jpeg'], ['png', 'image/png'], ['webp', 'image/webp']])('accepts %s', async (ext, type) => {
    backend.storage.upload.mockResolvedValue({ error: null });
    expect((await uploadMedia(new File(['image'], `ok.${ext}`, { type }))).path).toMatch(new RegExp(`\\.${ext}$`));
  });
  it('retains nested folder paths and paginates past 100 objects', async () => {
    backend.storage.list.mockImplementation((folder, { offset }) => Promise.resolve({ error: null, data:
      !folder ? [{ name: 'projects', id: null }] : folder === 'projects' ? [{ name: 'nested', id: null }] :
      offset === 0 ? Array.from({ length: 100 }, (_, n) => ({ id: String(n), name: `${n}.png` })) : [{ id: 'last', name: 'last.png' }],
    }));
    const files = await listMedia();
    expect(files).toHaveLength(101);
    expect(files[100].path).toBe('projects/nested/last.png');
  });
});
