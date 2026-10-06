import { Clock, FileText } from 'lucide-react';
import { fetchAllArticles, deleteArticle, updateArticleStatus } from '../../services/articleService';
import type { ArticleRecord } from '../../types/database';
import { useContentCollection } from '../hooks/useContentCollection';
import { ContentCollection } from '../components/ContentCollection';

const config = { label: '文章', load: fetchAllArticles, remove: deleteArticle, updateStatus: updateArticleStatus };

export function AdminArticles() {
  const collection = useContentCollection<ArticleRecord>(config);
  return <ContentCollection label="文章" description="管理技术记录与思考随笔，让写作、整理和发布更顺手。"
    icon={FileText} basePath="/admin/articles" records={collection.data} loading={collection.loading}
    error={collection.error} feedback={collection.feedback} pendingKey={collection.pendingKey}
    onReload={collection.reload} onStatusChange={collection.changeStatus} onDelete={collection.remove}
    getCategory={article => article.category_slug}
    getSearchText={article => [article.title, article.subtitle, article.slug, article.category,
      article.excerpt, ...(article.tags || [])].join(' ')}
    renderLeading={() => <span className="admin-content-thumb admin-content-thumb-placeholder"><FileText size={20} aria-hidden="true" /></span>}
    detailColumn={{ label: '文章信息', render: article => <div className="admin-content-meta"><span>{article.date || '未设置日期'}</span>
      <span className="admin-content-reading"><Clock size={12} aria-hidden="true" />{article.read_time || '未设置时长'}</span></div> }} />;
}
