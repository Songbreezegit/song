import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const backend = vi.hoisted(() => ({ configured: true, rpc: vi.fn() }));
vi.mock('../src/lib/supabase', () => ({
  get isSupabaseConfigured() { return backend.configured; },
  supabase: { rpc: backend.rpc },
}));
import { fetchAdminAnalytics, recordAnalyticsEvent, type AnalyticsEvent } from '../src/services/analyticsService';
import { createPublicAnalyticsTracker } from '../src/hooks/usePublicAnalytics';

const event: AnalyticsEvent = { eventId: '10000000-0000-4000-8000-000000000001', eventType: 'article_click', contentId: 'legacy-text-id' };
function snapshot(days = 30) {
  const startDate = '2026-10-01';
  const daily = Array.from({ length: days }, (_, index) => ({ date: new Date(Date.parse(startDate + 'T00:00:00Z') + index * 86400000).toISOString().slice(0, 10), pageViews: 0, articleClicks: 0, projectClicks: 0 }));
  return { enabled: true, timeZone: 'Asia/Shanghai', days, startDate, endDate: daily.at(-1)!.date,
    totalViews: 9, todayViews: 2, periodViews: 5, articleClicks: 3, projectClicks: 1, totalArticleClicks: 4, totalProjectClicks: 2,
    daily, articles: [{ id: 'legacy-text-id', title: 'Title', slug: 'title', status: 'published', clicks: 3, totalClicks: 4 }], projects: [] };
}
beforeEach(() => { vi.resetAllMocks(); backend.configured = true; });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('analytics service contracts', () => {
  it.each([7, 30, 90])('requests the selected %i-day period and retains real totals', async days => {
    backend.rpc.mockResolvedValue({ data: snapshot(days), error: null });
    expect(await fetchAdminAnalytics(days)).toEqual(snapshot(days));
    expect(backend.rpc).toHaveBeenCalledWith('get_admin_analytics', { p_days: days });
  });
  it('reports absent configuration and migrations without representing them as zero counters', async () => {
    backend.configured = false;
    expect(await fetchAdminAnalytics()).toEqual({ enabled: false, reason: 'not_configured' });
    expect(await recordAnalyticsEvent(event)).toBe(false);
    expect(backend.rpc).not.toHaveBeenCalled();
    backend.configured = true;
    for (const code of ['PGRST202', '42883']) {
      backend.rpc.mockResolvedValue({ data: null, error: { code }, status: 404 });
      expect(await fetchAdminAnalytics()).toEqual({ enabled: false, reason: 'migration_required' });
      expect(await recordAnalyticsEvent(event)).toBe(false);
    }
  });
  it('propagates permissions and transport failures without disguising them as a missing migration', async () => {
    const error = { code: '42501', message: 'Permission denied' };
    backend.rpc.mockResolvedValue({ data: null, error, status: 403 });
    await expect(fetchAdminAnalytics()).rejects.toBe(error);
    backend.rpc.mockRejectedValue(new Error('offline'));
    await expect(fetchAdminAnalytics()).rejects.toThrow('offline');
    await expect(fetchAdminAnalytics(365)).rejects.toThrow('7、30 或 90');
  });
  it.each([
    ['negative counter', (data: ReturnType<typeof snapshot>) => { data.periodViews = -1; }],
    ['unsafe integer', (data: ReturnType<typeof snapshot>) => { data.totalViews = Number.MAX_SAFE_INTEGER + 1; }],
    ['wrong period', (data: ReturnType<typeof snapshot>) => { data.days = 7; }],
    ['missing dates', (data: ReturnType<typeof snapshot>) => { data.daily.pop(); }],
    ['duplicated date', (data: ReturnType<typeof snapshot>) => { data.daily[1]!.date = data.daily[0]!.date; }],
    ['invalid content status', (data: ReturnType<typeof snapshot>) => { data.articles[0]!.status = 'invalid'; }],
  ])('rejects a malformed snapshot: %s', async (_name, corrupt) => {
    const data = snapshot(); corrupt(data);
    backend.rpc.mockResolvedValue({ data, error: null });
    await expect(fetchAdminAnalytics()).rejects.toThrow('数据格式不正确');
  });
  it.each(['resolved network failure', 'rejected SDK promise'])('retries %s exactly once with the same event UUID', async kind => {
    vi.useFakeTimers();
    if (kind === 'resolved network failure') backend.rpc.mockResolvedValueOnce({ data: null, error: { message: 'Response lost' }, status: 500 });
    else backend.rpc.mockRejectedValueOnce(new Error('Response lost'));
    backend.rpc.mockResolvedValueOnce({ data: true, error: null });
    const pending = recordAnalyticsEvent(event);
    await vi.advanceTimersByTimeAsync(250);
    expect(await pending).toBe(true);
    expect(backend.rpc).toHaveBeenCalledTimes(2);
    expect(backend.rpc.mock.calls[0]).toEqual(backend.rpc.mock.calls[1]);
    expect(backend.rpc).toHaveBeenCalledWith('record_analytics_event', { p_event_id: event.eventId, p_event_type: 'article_click', p_content_id: 'legacy-text-id' });
  });
  it('does not retry a denied write and respects duplicate or invalid target responses', async () => {
    const error = { code: '42501', message: 'Permission denied' };
    backend.rpc.mockResolvedValue({ data: null, error, status: 403 });
    await expect(recordAnalyticsEvent(event)).rejects.toBe(error);
    expect(backend.rpc).toHaveBeenCalledTimes(1);
    backend.rpc.mockResolvedValue({ data: false, error: null });
    expect(await recordAnalyticsEvent(event)).toBe(false);
  });
});

describe('public observation lifetime', () => {
  const closed = { section: 'home', pageReady: true, detailRequest: null, detailReady: false, contentType: null, contentId: null } as const;
  it('deduplicates repeated renders but counts section returns and successful reopenings', () => {
    const send = vi.fn().mockResolvedValue(true);
    const observe = createPublicAnalyticsTracker(send);
    observe({ ...closed, pageReady: false });
    expect(send).not.toHaveBeenCalled();
    observe(closed); observe(closed);
    observe({ ...closed, section: 'work' });
    observe({ ...closed, section: 'work' });
    observe(closed);
    const loading = { ...closed, detailRequest: 'article:title', contentType: 'article', contentId: 'legacy-text-id' } as const;
    observe(loading); observe(loading);
    observe({ ...loading, detailReady: true }); observe({ ...loading, detailReady: true });
    // A data refetch does not constitute a second opening.
    observe(loading); observe({ ...loading, detailReady: true });
    observe(closed); observe({ ...loading, detailReady: true });
    expect(send.mock.calls.map(([submitted]) => submitted.eventType)).toEqual(['page_view', 'page_view', 'page_view', 'article_click', 'article_click']);
    expect(new Set(send.mock.calls.map(([submitted]) => submitted.eventId)).size).toBe(5);
    observe.leavePublic(); observe({ ...loading, detailReady: true });
    expect(send.mock.calls.slice(-2).map(([submitted]) => submitted.eventType)).toEqual(['page_view', 'article_click']);
  });
  it('waits for actual content and leaves the observation usable after collector failures', async () => {
    const send = vi.fn().mockRejectedValue(new Error('collector offline'));
    const observe = createPublicAnalyticsTracker(send);
    const missing = { ...closed, detailRequest: 'project:missing', detailReady: true, contentType: 'project', contentId: null } as const;
    expect(() => observe(missing)).not.toThrow();
    observe(missing);
    observe({ ...missing, contentId: 'legacy-project' });
    await Promise.resolve();
    expect(send.mock.calls.map(([submitted]) => submitted.eventType)).toEqual(['page_view', 'project_click']);
    const synchronous = createPublicAnalyticsTracker(() => { throw new Error('SDK failed'); });
    expect(() => synchronous(closed)).not.toThrow();
  });
});
