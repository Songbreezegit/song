import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FolderGit2,
  FileText,
  Plus,
  ArrowRight,
  Clock,
  CheckCircle2,
  FileEdit,
} from 'lucide-react';
import { fetchAllProjects } from '../../services/projectService';
import { fetchAllArticles } from '../../services/articleService';
import type { ProjectRecord, ArticleRecord } from '../../types/database';
import { isSupabaseConfigured } from '../../lib/supabase';

interface RecentItem {
  id: string;
  title: string;
  type: 'project' | 'article';
  status: string;
  updated_at: string;
}

export function AdminDashboard() {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [articles, setArticles] = useState<ArticleRecord[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!isSupabaseConfigured) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const [projList, artList] = await Promise.all([
          fetchAllProjects(),
          fetchAllArticles(),
        ]);
        setProjects(projList);
        setArticles(artList);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const publishedProjects = projects.filter((p) => p.status === 'published').length;
  const draftProjects = projects.filter((p) => p.status === 'draft').length;

  const publishedArticles = articles.filter((a) => a.status === 'published').length;
  const draftArticles = articles.filter((a) => a.status === 'draft').length;

  // Combine and sort recent updates
  const recentItems: RecentItem[] = [
    ...projects.map((p) => ({
      id: p.id,
      title: p.title,
      type: 'project' as const,
      status: p.status,
      updated_at: p.updated_at,
    })),
    ...articles.map((a) => ({
      id: a.id,
      title: a.title,
      type: 'article' as const,
      status: a.status,
      updated_at: a.updated_at,
    })),
  ].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, 6);

  return (
    <div>
      {error && <p role="alert" className="admin-alert admin-alert-error">统计加载失败，请刷新重试。</p>}
      {/* Quick Actions */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <Link to="/admin/projects/new" className="admin-btn admin-btn-primary">
          <Plus size={16} />
          <span>新建项目</span>
        </Link>
        <Link to="/admin/articles/new" className="admin-btn admin-btn-secondary">
          <Plus size={16} />
          <span>新建文章</span>
        </Link>
        <Link to="/admin/media" className="admin-btn admin-btn-secondary">
          <span>媒体库</span>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-label">Projects · 作品项目</div>
          <div className="admin-stat-value">{loading ? '...' : error ? '—' : projects.length}</div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '10px', fontSize: '13px', color: 'var(--admin-text-secondary)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle2 size={13} color="var(--admin-success)" />
              {publishedProjects} 已发布
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <FileEdit size={13} color="var(--admin-warning)" />
              {draftProjects} 草稿
            </span>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-label">Articles · 思考与笔记</div>
          <div className="admin-stat-value">{loading ? '...' : error ? '—' : articles.length}</div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '10px', fontSize: '13px', color: 'var(--admin-text-secondary)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle2 size={13} color="var(--admin-success)" />
              {publishedArticles} 已发布
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <FileEdit size={13} color="var(--admin-warning)" />
              {draftArticles} 草稿
            </span>
          </div>
        </div>
      </div>

      {/* Recent Updates */}
      <div className="admin-card">
        <div className="admin-card-header">
          <h3 className="admin-card-title">最近内容变动</h3>
        </div>

        {loading ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--admin-text-secondary)' }}>
            <div className="admin-spinner" style={{ margin: '0 auto 12px' }} />
            正在加载数据...
          </div>
        ) : recentItems.length === 0 ? (
          <p style={{ color: 'var(--admin-text-secondary)', margin: 0, fontSize: '13px' }}>
            暂无更新记录。请新建项目或文章。
          </p>
        ) : (
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>标题</th>
                  <th>类型</th>
                  <th>状态</th>
                  <th>更新时间</th>
                  <th style={{ textAlign: 'right' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {recentItems.map((item) => (
                  <tr key={`${item.type}-${item.id}`}>
                    <td style={{ fontWeight: 500 }}>{item.title}</td>
                    <td>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {item.type === 'project' ? (
                          <>
                            <FolderGit2 size={14} color="var(--admin-accent)" />
                            项目
                          </>
                        ) : (
                          <>
                            <FileText size={14} color="#10B981" />
                            文章
                          </>
                        )}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`admin-status-badge ${
                          item.status === 'published'
                            ? 'admin-status-published'
                            : item.status === 'draft'
                            ? 'admin-status-draft'
                            : 'admin-status-archived'
                        }`}
                      >
                        {item.status === 'published' ? '已发布' : item.status === 'draft' ? '草稿' : '已归档'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--admin-text-secondary)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={13} />
                        {new Date(item.updated_at).toLocaleDateString('zh-CN')}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Link
                        to={item.type === 'project' ? `/admin/projects/${item.id}` : `/admin/articles/${item.id}`}
                        className="admin-btn admin-btn-secondary admin-btn-sm"
                      >
                        <span>编辑</span>
                        <ArrowRight size={13} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
