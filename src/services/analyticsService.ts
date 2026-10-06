import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { ContentStatus } from '../types/database';

export interface AnalyticsContentItem {
  id: string;
  title: string;
  slug: string;
  status: ContentStatus;
  clicks: number;
  totalClicks: number;
}
export interface AnalyticsDailyPoint {
  date: string;
  pageViews: number;
  articleClicks: number;
  projectClicks: number;
}
export interface EnabledAdminAnalytics {
  enabled: true;
  timeZone: 'Asia/Shanghai';
  days: number;
  startDate: string;
  endDate: string;
  totalViews: number;
  todayViews: number;
  periodViews: number;
  articleClicks: number;
  projectClicks: number;
  totalArticleClicks: number;
  totalProjectClicks: number;
  daily: AnalyticsDailyPoint[];
  articles: AnalyticsContentItem[];
  projects: AnalyticsContentItem[];
}
export type AdminAnalyticsData = EnabledAdminAnalytics | {
  enabled: false;
  reason: 'not_configured' | 'migration_required';
};
export interface AnalyticsEvent {
  eventId: string;
  eventType: 'page_view' | 'article_click' | 'project_click';
  contentId: string | null;
}

function isMissingAnalytics(error: { code?: string }): boolean {
  return error.code === 'PGRST202' || error.code === '42883';
}
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
function isDailyPoint(value: unknown): value is AnalyticsDailyPoint {
  return isObject(value) && typeof value.date === 'string' && isCount(value.pageViews) && isCount(value.articleClicks) && isCount(value.projectClicks);
}
function isContentItem(value: unknown): value is AnalyticsContentItem {
  return isObject(value) && typeof value.id === 'string' && typeof value.title === 'string' && typeof value.slug === 'string'
    && ['draft', 'published', 'archived'].includes(String(value.status)) && isCount(value.clicks) && isCount(value.totalClicks);
}
function isAnalyticsSnapshot(value: unknown, expectedDays: number): value is EnabledAdminAnalytics {
  if (!isObject(value) || value.enabled !== true || value.timeZone !== 'Asia/Shanghai'
    || value.days !== expectedDays || typeof value.startDate !== 'string' || typeof value.endDate !== 'string') return false;
  for (const key of ['totalViews', 'todayViews', 'periodViews', 'articleClicks', 'projectClicks', 'totalArticleClicks', 'totalProjectClicks']) {
    if (!isCount(value[key])) return false;
  }
  if (!Array.isArray(value.daily) || value.daily.length !== expectedDays || !value.daily.every(isDailyPoint)) return false;
  const startTime = Date.parse(value.startDate + 'T00:00:00Z');
  if (!Number.isFinite(startTime) || value.daily[0]?.date !== value.startDate || value.daily.at(-1)?.date !== value.endDate
    || value.daily.some((point, index) => point.date !== new Date(startTime + index * 86400000).toISOString().slice(0, 10))) return false;
  return Array.isArray(value.articles) && value.articles.every(isContentItem)
    && Array.isArray(value.projects) && value.projects.every(isContentItem);
}

export async function fetchAdminAnalytics(days = 30): Promise<AdminAnalyticsData> {
  if (![7, 30, 90].includes(days)) throw new Error('统计范围只能选择 7、30 或 90 天。');
  if (!isSupabaseConfigured) return { enabled: false, reason: 'not_configured' };
  const { data, error } = await supabase.rpc('get_admin_analytics', { p_days: days });
  if (error) {
    if (isMissingAnalytics(error)) return { enabled: false, reason: 'migration_required' };
    throw error;
  }
  if (!isAnalyticsSnapshot(data, days)) throw new Error('统计服务返回的数据格式不正确，请重新加载。');
  return data;
}

// The same per-event UUID is used for both attempts. A response lost after the
// database commit therefore cannot cause a second increment on retry.
export async function recordAnalyticsEvent(event: AnalyticsEvent): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  for (let attempt = 0; attempt < 2; attempt++) {
    let response;
    try {
      response = await supabase.rpc('record_analytics_event', {
        p_event_id: event.eventId,
        p_event_type: event.eventType,
        p_content_id: event.contentId,
      });
    } catch (error) {
      if (attempt === 0) {
        await new Promise<void>(resolve => setTimeout(resolve, 250));
        continue;
      }
      throw error;
    }
    const { data, error, status } = response;
    if (!error) return data === true;
    if (isMissingAnalytics(error)) return false;
    if (attempt === 0 && (status === 0 || status >= 500 || !error.code)) {
      await new Promise<void>(resolve => setTimeout(resolve, 250));
      continue;
    }
    throw error;
  }
  return false;
}
