import { Link } from 'react-router-dom';
import { FolderGit2, FileText, Plus, ArrowRight, Clock, CheckCircle2, FileEdit } from 'lucide-react';
import { fetchAdminDashboard, type AdminDashboardData } from '../../services/adminService';
import { useAdminQuery } from '../hooks/useAdminQuery';
import { AdminQueryError } from '../components/AdminQueryError';

const emptyDashboard: AdminDashboardData = { projects: { total: 0, published: 0, draft: 0 }, articles: { total: 0, published: 0, draft: 0 }, recentItems: [] };

export function AdminDashboard() {
  const { data, loading, error, reload } = useAdminQuery(fetchAdminDashboard, emptyDashboard, '统计加载失败，请重试。');

  return (
    <div>
      <AdminQueryError error={error} onRetry={reload} />
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
          <div className="admin-stat-value">{loading ? '...' : error ? '—' : data.projects.total}</div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '10px', fontSize: '13px', color: 'var(--admin-text-secondary)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle2 size={13} color="var(--admin-success)" />
              {loading || error ? '—' : data.projects.published} 已发布
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <FileEdit size={13} color="var(--admin-warning)" />
              {loading || error ? '—' : data.projects.draft} 草稿
            </span>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-label">Articles · 思考与笔记</div>
          <div className="admin-stat-value">{loading ? '...' : error ? '—' : data.articles.total}</div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '10px', fontSize: '13px', color: 'var(--admin-text-secondary)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle2 size={13} color="var(--admin-success)" />
              {loading || error ? '—' : data.articles.published} 已发布
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <FileEdit size={13} color="var(--admin-warning)" />
              {loading || error ? '—' : data.articles.draft} 草稿
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
        ) : error ? null : data.recentItems.length === 0 ? (
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
                {data.recentItems.map((item) => (
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
