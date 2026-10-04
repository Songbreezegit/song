import { Link } from 'react-router-dom';
import { Plus, Edit2, Trash2, RefreshCw, Clock } from 'lucide-react';
import { fetchAllArticles, deleteArticle, updateArticleStatus } from '../../services/articleService';
import type { ArticleRecord } from '../../types/database';
import { useContentCollection } from '../hooks/useContentCollection';
import { AdminFeedback } from '../components/AdminFeedback';
import { AdminLoading } from '../components/AdminLoading';
import { AdminQueryError } from '../components/AdminQueryError';

const config = { label: '文章', load: fetchAllArticles, remove: deleteArticle, updateStatus: updateArticleStatus };

export function AdminArticles() {
  const { data: articles, loading, error, reload: loadArticles, feedback, pendingKey: actionInProgress,
    changeStatus: handleStatusChange, remove: handleDelete } = useContentCollection<ArticleRecord>(config);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <p style={{ margin: 0, fontSize: '14px', color: 'var(--admin-text-secondary)' }}>
          管理 SONG ISLE 所有的技术文章、思考随笔与学习笔记。
        </p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={loadArticles}
            className="admin-btn admin-btn-secondary"
            title="刷新"
            disabled={loading || Boolean(actionInProgress)}
          >
            <RefreshCw size={15} className={loading ? 'admin-spinner' : ''} />
          </button>
          <Link to="/admin/articles/new" className="admin-btn admin-btn-primary">
            <Plus size={16} />
            <span>新建文章</span>
          </Link>
        </div>
      </div>

      <AdminFeedback feedback={feedback} />

      <div className="admin-card" style={{ padding: 0 }}>
        {loading ? (
          <AdminLoading message="正在加载文章列表..." />
        ) : error ? (
          <AdminQueryError error={error} onRetry={loadArticles} />
        ) : articles.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--admin-text-secondary)' }}>
            <p>暂无文章记录。</p>
            <Link to="/admin/articles/new" className="admin-btn admin-btn-primary admin-btn-sm" style={{ marginTop: '12px' }}>
              立即创建第一篇文章
            </Link>
          </div>
        ) : (
          <div className="admin-table-container" style={{ border: 'none' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>标题 / 副标题</th>
                  <th>分类</th>
                  <th>日期</th>
                  <th>阅读时间</th>
                  <th>状态</th>
                  <th>更新时间</th>
                  <th style={{ textAlign: 'right' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {articles.map((article) => (
                  <tr key={article.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{article.title}</div>
                      <div style={{ fontSize: '12px', color: 'var(--admin-text-secondary)' }}>
                        {article.subtitle || article.slug}
                      </div>
                    </td>
                    <td>
                      <span className="admin-tag-pill">{article.category}</span>
                    </td>
                    <td>{article.date}</td>
                    <td>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--admin-text-secondary)' }}>
                        <Clock size={13} />
                        {article.read_time}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`admin-status-badge ${
                          article.status === 'published'
                            ? 'admin-status-published'
                            : article.status === 'draft'
                            ? 'admin-status-draft'
                            : 'admin-status-archived'
                        }`}
                      >
                        {article.status === 'published' ? '已发布' : article.status === 'draft' ? '草稿' : '已归档'}
                      </span>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--admin-text-secondary)' }}>
                      {new Date(article.updated_at).toLocaleDateString('zh-CN')}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        {article.status !== 'published' ? (
                          <button
                            className="admin-btn admin-btn-secondary admin-btn-sm"
                            onClick={() => handleStatusChange(article.id, 'published')}
                            disabled={Boolean(actionInProgress)}
                            title="发布到前台"
                          >
                            发布
                          </button>
                        ) : (
                          <button
                            className="admin-btn admin-btn-secondary admin-btn-sm"
                            onClick={() => handleStatusChange(article.id, 'draft')}
                            disabled={Boolean(actionInProgress)}
                            title="转为草稿下线"
                          >
                            转草稿
                          </button>
                        )}
                        <Link
                          to={`/admin/articles/${article.id}`}
                          className="admin-btn admin-btn-secondary admin-btn-sm"
                          title="编辑文章"
                        >
                          <Edit2 size={13} />
                        </Link>
                        <button
                          className="admin-btn admin-btn-danger admin-btn-sm"
                          onClick={() => handleDelete(article.id, article.title)}
                          disabled={Boolean(actionInProgress)}
                          title="删除文章"
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
