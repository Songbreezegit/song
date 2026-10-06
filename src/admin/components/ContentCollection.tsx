import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Archive, Edit2, Plus, RefreshCw, SearchX, Trash2, type LucideIcon } from 'lucide-react';
import type { ContentStatus } from '../../types/database';
import type { AdminFeedbackMessage } from '../lib/feedback';
import { contentStatusLabels, formatCollectionDate } from '../lib/collection';
import { useCollectionView } from '../hooks/useCollectionView';
import { AdminFeedback } from './AdminFeedback';
import { AdminLoading } from './AdminLoading';
import { AdminQueryError } from './AdminQueryError';
import { AdminPageHeader } from './AdminPageHeader';
import { ContentStatusBadge } from './ContentStatusBadge';
import { CollectionPagination, CollectionToolbar } from './CollectionControls';

interface ContentItem {
  id: string; title: string; subtitle: string; slug: string; category: string;
  status: ContentStatus; updated_at: string; sort_order: number;
}

interface ContentCollectionProps<T extends ContentItem> {
  label: string;
  description: string;
  icon: LucideIcon;
  basePath: string;
  records: T[];
  loading: boolean;
  error: string | null;
  feedback: AdminFeedbackMessage | null;
  pendingKey: string | null;
  onReload: () => void;
  onStatusChange: (id: string, status: ContentStatus) => void;
  onDelete: (id: string, title: string) => void;
  getSearchText: (record: T) => string;
  getCategory?: (record: T) => string;
  getCategoryLabel?: (record: T) => string;
  renderLeading?: (record: T) => ReactNode;
  detailColumn: { label: string; render: (record: T) => ReactNode };
}

export function ContentCollection<T extends ContentItem>({ label, description, icon: Icon, basePath,
  records, loading, error, feedback, pendingKey, onReload, onStatusChange, onDelete,
  getSearchText, getCategory = record => record.category, getCategoryLabel = record => record.category, renderLeading, detailColumn }: ContentCollectionProps<T>) {
  const view = useCollectionView(records.map(record => ({
    key: record.id, title: record.title, searchText: getSearchText(record), category: getCategory(record),
    status: record.status, updatedAt: record.updated_at, order: record.sort_order, record,
  })));
  const categories = [...new Map(records.map(record => [getCategory(record), {
    value: getCategory(record), label: getCategoryLabel(record),
  }])).values()].sort((left, right) => left.label.localeCompare(right.label, 'zh-CN'));
  const navigationState = { returnTo: `${basePath}${view.search}` };
  const busy = Boolean(pendingKey);
  const statuses = ['all', 'draft', 'published', 'archived'] as const;

  return <div className="admin-collection-page">
    <AdminPageHeader eyebrow="内容管理" title={`${label}工作区`} description={description} actions={<>
      <button onClick={onReload} className="admin-btn admin-btn-secondary" title="刷新" aria-label={`刷新${label}`}
        disabled={loading || busy}><RefreshCw size={15} className={loading ? 'admin-spinner' : ''} />刷新</button>
      <Link to={`${basePath}/new`} state={navigationState} className="admin-btn admin-btn-primary"><Plus size={16} />新建{label}</Link>
    </>} />
    <AdminFeedback feedback={feedback} />
    <section className="admin-card admin-collection-card" aria-label={`${label}列表`}>
      <div className="admin-status-tabs" role="group" aria-label={`${label}状态筛选`}>
        {statuses.map(status => <button key={status} className={`admin-status-tab${view.filters.status === status ? ' is-active' : ''}`}
          aria-pressed={view.filters.status === status} onClick={() => view.updateFilter('status', status)}>
          {status === 'all' ? '全部' : contentStatusLabels[status]}
          <span>{loading || error ? '—' : status === 'all' ? records.length : records.filter(record => record.status === status).length}</span>
        </button>)}
      </div>
      <CollectionToolbar label={label} query={view.filters.query} onQuery={value => view.updateFilter('query', value)}
        category={view.filters.category} categories={categories} onCategory={value => view.updateFilter('category', value)}
        sort={view.filters.sort} onSort={value => view.updateFilter('sort', value)} hasFilters={view.hasFilters} onClear={view.clearFilters} />
      {loading ? <AdminLoading message={`正在加载${label}列表...`} /> : error ? <AdminQueryError error={error} onRetry={onReload} /> :
        records.length === 0 ? <div className="admin-empty-state">
          <div className="admin-empty-icon"><Icon size={28} /></div>
          <h3>暂无{label}记录。</h3><p>从第一{label === '文章' ? '篇文章' : '个项目'}开始，将想法整理成可以发布的内容。</p>
          <Link to={`${basePath}/new`} state={navigationState} className="admin-btn admin-btn-primary"><Plus size={15} />新建{label}</Link>
        </div> : view.total === 0 ? <div className="admin-empty-state">
          <div className="admin-empty-icon"><SearchX size={28} /></div><h3>没有匹配的{label}</h3>
          <p>试试其他关键词，或清除筛选查看全部内容。</p>
          <button className="admin-btn admin-btn-secondary" onClick={view.clearFilters}>清除筛选</button>
        </div> : <>
          <div className="admin-table-container admin-content-table-container">
            <table className="admin-table admin-content-table">
              <thead><tr><th>{label}内容</th><th>分类</th><th>{detailColumn.label}</th><th>状态</th><th>更新时间</th><th className="admin-table-actions-heading">操作</th></tr></thead>
              <tbody>{view.visible.map(({ record }) => <tr key={record.id} aria-busy={pendingKey === record.id}>
                <td><div className="admin-content-identity">{renderLeading?.(record)}<div>
                  <Link to={`${basePath}/${record.id}`} state={navigationState} className="admin-content-title">{record.title}</Link>
                  <div className="admin-content-subtitle">{record.subtitle || record.slug}</div>
                </div></div></td>
                <td><span className="admin-tag-pill">{getCategoryLabel(record)}</span></td>
                <td>{detailColumn.render(record)}</td>
                <td><ContentStatusBadge status={record.status} /></td>
                <td className="admin-content-date">{formatCollectionDate(record.updated_at)}</td>
                <td><div className="admin-row-actions">
                  <button className="admin-btn admin-btn-secondary admin-btn-sm" disabled={busy}
                    title={record.status === 'published' ? '转为草稿下线' : '发布到前台'}
                    onClick={() => onStatusChange(record.id, record.status === 'published' ? 'draft' : 'published')}>
                    {pendingKey === record.id ? '处理中…' : record.status === 'published' ? '转草稿' : '发布'}
                  </button>
                  <Link to={`${basePath}/${record.id}`} state={navigationState} className="admin-btn admin-btn-secondary admin-btn-sm"
                    title={`编辑${label}`} aria-label={`编辑${label}：${record.title}`}><Edit2 size={14} /></Link>
                  {record.status !== 'archived' && <button className="admin-btn admin-btn-secondary admin-btn-sm" disabled={busy}
                    title={`归档${label}`} aria-label={`归档${label}：${record.title}`} onClick={() => onStatusChange(record.id, 'archived')}><Archive size={14} /></button>}
                  <button className="admin-btn admin-btn-danger admin-btn-sm" disabled={busy} title={`删除${label}`}
                    aria-label={`删除${label}：${record.title}`} onClick={() => onDelete(record.id, record.title)}><Trash2 size={14} /></button>
                </div></td>
              </tr>)}</tbody>
            </table>
          </div>
          <CollectionPagination total={view.total} page={view.page} pageCount={view.pageCount} pageSize={view.pageSize}
            onPage={value => view.updateFilter('page', value)} />
        </>}
    </section>
  </div>;
}
