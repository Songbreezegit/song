import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Clock,
} from 'lucide-react';
import {
  fetchAllArticles,
  deleteArticle,
  updateArticleStatus,
} from '../../services/articleService';
import type { ArticleRecord, ContentStatus } from '../../types/database';
import { isSupabaseConfigured } from '../../lib/supabase';

export function AdminArticles() {
  const [articles, setArticles] = useState<ArticleRecord[]>([]);
  const [loading, setLoading] = useState(Boolean(isSupabaseConfigured));
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const loadArticles = async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await fetchAllArticles();
      setArticles(data);
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : '加载文章列表失败',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    if (!isSupabaseConfigured) return;
    fetchAllArticles()
      .then((data) => {
        if (active) {
          setArticles(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setFeedback({
            type: 'error',
            message: err instanceof Error ? err.message : '加载文章列表失败',
          });
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const handleStatusChange = async (id: string, newStatus: ContentStatus) => {
    try {
      setActionInProgress(id);
      await updateArticleStatus(id, newStatus);
      setFeedback({ type: 'success', message: `文章状态已更新为：${newStatus}` });
      await loadArticles();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : '更新文章状态失败',
      });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`确定要彻底删除文章「${title}」吗？此操作不可撤销。`)) {
      return;
    }

    try {
      setActionInProgress(id);
      await deleteArticle(id);
      setFeedback({ type: 'success', message: `文章「${title}」已成功删除` });
      setArticles((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : '删除文章失败',
      });
    } finally {
      setActionInProgress(null);
    }
  };

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
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? 'admin-spinner' : ''} />
          </button>
          <Link to="/admin/articles/new" className="admin-btn admin-btn-primary">
            <Plus size={16} />
            <span>新建文章</span>
          </Link>
        </div>
      </div>

      {feedback && (
        <div
          className={`admin-alert ${
            feedback.type === 'success' ? 'admin-alert-success' : 'admin-alert-error'
          }`}
        >
          {feedback.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <div>{feedback.message}</div>
        </div>
      )}

      <div className="admin-card" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--admin-text-secondary)' }}>
            <div className="admin-spinner" style={{ margin: '0 auto 12px' }} />
            正在加载文章列表...
          </div>
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
                            disabled={actionInProgress === article.id}
                            title="发布到前台"
                          >
                            发布
                          </button>
                        ) : (
                          <button
                            className="admin-btn admin-btn-secondary admin-btn-sm"
                            onClick={() => handleStatusChange(article.id, 'draft')}
                            disabled={actionInProgress === article.id}
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
                          disabled={actionInProgress === article.id}
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
