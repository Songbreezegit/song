import { Link } from 'react-router-dom';
import { Plus, Edit2, Trash2, RefreshCw, Star } from 'lucide-react';
import { fetchAllProjects, deleteProject, updateProjectStatus } from '../../services/projectService';
import type { ProjectRecord } from '../../types/database';
import { useContentCollection } from '../hooks/useContentCollection';
import { AdminFeedback } from '../components/AdminFeedback';
import { AdminLoading } from '../components/AdminLoading';
import { AdminQueryError } from '../components/AdminQueryError';

const config = { label: '项目', load: fetchAllProjects, remove: deleteProject, updateStatus: updateProjectStatus };

export function AdminProjects() {
  const { data: projects, loading, error, reload: loadProjects, feedback, pendingKey: actionInProgress,
    changeStatus: handleStatusChange, remove: handleDelete } = useContentCollection<ProjectRecord>(config);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <p style={{ margin: 0, fontSize: '14px', color: 'var(--admin-text-secondary)' }}>
          管理 SONG ISLE 所有的作品、开源与独立工具记录。
        </p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={loadProjects}
            className="admin-btn admin-btn-secondary"
            title="刷新"
            disabled={loading || Boolean(actionInProgress)}
          >
            <RefreshCw size={15} className={loading ? 'admin-spinner' : ''} />
          </button>
          <Link to="/admin/projects/new" className="admin-btn admin-btn-primary">
            <Plus size={16} />
            <span>新建项目</span>
          </Link>
        </div>
      </div>

      <AdminFeedback feedback={feedback} />

      <div className="admin-card" style={{ padding: 0 }}>
        {loading ? (
          <AdminLoading message="正在加载项目列表..." />
        ) : error ? (
          <AdminQueryError error={error} onRetry={loadProjects} />
        ) : projects.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--admin-text-secondary)' }}>
            <p>暂无项目记录。</p>
            <Link to="/admin/projects/new" className="admin-btn admin-btn-primary admin-btn-sm" style={{ marginTop: '12px' }}>
              立即创建第一个项目
            </Link>
          </div>
        ) : (
          <div className="admin-table-container" style={{ border: 'none' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>标题 / 副标题</th>
                  <th>分类</th>
                  <th>年份</th>
                  <th>精选</th>
                  <th>状态</th>
                  <th>更新时间</th>
                  <th style={{ textAlign: 'right' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr key={project.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{project.title}</div>
                      <div style={{ fontSize: '12px', color: 'var(--admin-text-secondary)' }}>
                        {project.subtitle || project.slug}
                      </div>
                    </td>
                    <td>
                      <span className="admin-tag-pill">{project.category_label || project.category}</span>
                    </td>
                    <td>{project.year}</td>
                    <td>
                      {project.featured ? (
                        <span title="精选推荐" style={{ color: '#F59E0B', display: 'flex', alignItems: 'center' }}>
                          <Star size={15} fill="#F59E0B" />
                        </span>
                      ) : (
                        <span style={{ color: 'var(--admin-text-muted)' }}>-</span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`admin-status-badge ${
                          project.status === 'published'
                            ? 'admin-status-published'
                            : project.status === 'draft'
                            ? 'admin-status-draft'
                            : 'admin-status-archived'
                        }`}
                      >
                        {project.status === 'published' ? '已发布' : project.status === 'draft' ? '草稿' : '已归档'}
                      </span>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--admin-text-secondary)' }}>
                      {new Date(project.updated_at).toLocaleDateString('zh-CN')}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        {project.status !== 'published' ? (
                          <button
                            className="admin-btn admin-btn-secondary admin-btn-sm"
                            onClick={() => handleStatusChange(project.id, 'published')}
                            disabled={Boolean(actionInProgress)}
                            title="发布到前台"
                          >
                            发布
                          </button>
                        ) : (
                          <button
                            className="admin-btn admin-btn-secondary admin-btn-sm"
                            onClick={() => handleStatusChange(project.id, 'draft')}
                            disabled={Boolean(actionInProgress)}
                            title="转为草稿下线"
                          >
                            转草稿
                          </button>
                        )}
                        <Link
                          to={`/admin/projects/${project.id}`}
                          className="admin-btn admin-btn-secondary admin-btn-sm"
                          title="编辑项目"
                        >
                          <Edit2 size={13} />
                        </Link>
                        <button
                          className="admin-btn admin-btn-danger admin-btn-sm"
                          onClick={() => handleDelete(project.id, project.title)}
                          disabled={Boolean(actionInProgress)}
                          title="删除项目"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
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
