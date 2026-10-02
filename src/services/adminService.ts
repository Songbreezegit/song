import { supabase } from '../lib/supabase';
import { fetchAllProjects } from './projectService';
import { fetchAllArticles } from './articleService';
import type { ContentStatus } from '../types/database';

export interface AdminRecentItem {
  id: string;
  title: string;
  type: 'project' | 'article';
  status: ContentStatus;
  updated_at: string;
}

export interface AdminDashboardData {
  projects: { total: number; published: number; draft: number };
  articles: { total: number; published: number; draft: number };
  recentItems: AdminRecentItem[];
}

export async function fetchAdminDashboard(): Promise<AdminDashboardData> {
  const [projects, articles] = await Promise.all([fetchAllProjects(), fetchAllArticles()]);
  const count = (records: { status: ContentStatus }[]) => ({ total: records.length,
    published: records.filter(record => record.status === 'published').length,
    draft: records.filter(record => record.status === 'draft').length });
  const recentItems: AdminRecentItem[] = [
    ...projects.map(({ id, title, status, updated_at }) => ({ id, title, status, updated_at, type: 'project' as const })),
    ...articles.map(({ id, title, status, updated_at }) => ({ id, title, status, updated_at, type: 'article' as const })),
  ].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, 6);
  return { projects: count(projects), articles: count(articles), recentItems };
}

export async function verifyAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase.from('admin_users')
    .select('user_id').eq('user_id', userId).maybeSingle();
  if (error) throw new Error('无法验证管理员权限，请检查连接和数据库迁移。');
  return data?.user_id === userId;
}
