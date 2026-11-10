import { Link } from 'react-router-dom';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import { deleteDistributionDraft, fetchDistributionPosts } from '../../services/distributionService';
import { fetchAllProjects } from '../../services/projectService';
import { useAdminQuery } from '../hooks/useAdminQuery';
import { useAdminAction } from '../hooks/useAdminAction';
import { useDistributionCollection } from '../features/distribution/useDistributionCollection';
import { DistributionEmpty, DistributionStatus, DistributionTabs } from '../features/distribution/DistributionChrome';
import { contentTypeLabels, goalLabels, postStatusLabels } from '../features/distribution/distributionForm';
import { AdminFeedback } from '../components/AdminFeedback';
import { AdminPageHeader } from '../components/AdminPageHeader';
import { AdminLoading } from '../components/AdminLoading';
import { AdminQueryError } from '../components/AdminQueryError';
import { CollectionPagination, CollectionToolbar } from '../components/CollectionControls';
import { formatCollectionDate } from '../lib/collection';
import type { DistributionPostRecord } from '../../types/distribution';
import type { ProjectRecord } from '../../types/database';

const load = async () => { const [posts, projects] = await Promise.all([fetchDistributionPosts(), fetchAllProjects()]); return { posts, projects }; };
export function AdminDistributionPosts() {
  const query = useAdminQuery(load, { posts: [] as DistributionPostRecord[], projects: [] as ProjectRecord[] }, '内容库加载失败，请重试。');
  const action = useAdminAction('删除失败，请重试。');
  const view = useDistributionCollection(query.data.posts.map(post => ({ key: post.id, title: post.title, searchText: `${post.title} ${post.body} ${post.tags.join(' ')}`,
    category: post.content_type, updatedAt: post.updated_at, stage: post.status, projectId: post.project_id, post })), ['draft', 'ready']);
  const navigationState = { returnTo: `/admin/distribution/posts${view.search}` };
  const remove = (post: DistributionPostRecord) => {
    if (!window.confirm(`确定删除草稿「${post.title}」吗？关联的所有平台稿（包括历史稿件）会一起删除。请先导出需要保留的版本，此操作不可撤销。`)) return;
    void action.run(post.id, () => deleteDistributionDraft(post.id, post.version), { successMessage: '草稿已删除。', onSuccess: () => query.setData(previous => ({ ...previous, posts: previous.posts.filter(row => row.id !== post.id) })) });
  };
  return <div className="distribution-workspace"><AdminPageHeader title="分发内容库" description="集中准备内容源，为不同平台保留延展空间。" actions={<>
    <button className="admin-btn admin-btn-secondary" onClick={query.reload} disabled={query.loading || Boolean(action.pendingKey)} aria-label="刷新分发内容"><RefreshCw size={15} />刷新</button>
    <Link className="admin-btn admin-btn-primary" to="/admin/distribution/posts/new" state={navigationState}><Plus size={16} />新建内容</Link></>} /><DistributionTabs /><AdminFeedback feedback={action.feedback} />
    <section className="admin-card admin-collection-card" aria-label="分发内容列表">
      <div className="admin-status-tabs" role="group" aria-label="分发内容状态筛选">{['', 'draft', 'ready'].map(stage => <button key={stage} className={`admin-status-tab${view.stage === stage ? ' is-active' : ''}`} aria-pressed={view.stage === stage} onClick={() => view.setFilter('stage', stage)}>
        {stage ? postStatusLabels[stage as keyof typeof postStatusLabels] : '全部'}<span>{query.loading || query.error ? '—' : query.data.posts.filter(post => !stage || post.status === stage).length}</span></button>)}</div>
      <CollectionToolbar label="分发内容" query={view.filters.query} onQuery={value => view.updateFilter('query', value)} category={view.filters.category} categories={Object.entries(contentTypeLabels).map(([value, label]) => ({ value, label }))}
        categoryLabel="类型" onCategory={value => view.updateFilter('category', value)} sort={view.filters.sort} onSort={value => view.updateFilter('sort', value)} includeOrder={false} hasFilters={view.hasFilters} onClear={view.clearFilters} />
      <label className="distribution-project-filter admin-filter-field"><span>关联项目</span><select className="admin-select" aria-label="分发内容关联项目" value={view.project} onChange={event => view.setFilter('project', event.target.value)}><option value="">全部项目</option>{query.data.projects.map(project => <option value={project.id} key={project.id}>{project.title}</option>)}</select></label>
      {query.loading ? <AdminLoading /> : query.error ? <AdminQueryError error={query.error} onRetry={query.reload} /> : !query.data.posts.length ? <DistributionEmpty title="内容库还是空的" description="写下第一份草稿，选择推广目标并整理素材。" to="/admin/distribution/posts/new" action="新建内容" />
        : !view.total ? <DistributionEmpty title="没有匹配的内容" description="调整关键词或清除筛选，查看其他内容。" /> : <>
          <div className="admin-table-container admin-content-table-container"><table className="admin-table distribution-post-table"><thead><tr><th>内容</th><th>类型与目标</th><th>关联项目</th><th>状态</th><th>最近更新</th><th>操作</th></tr></thead>
            <tbody>{view.visible.map(({ post }) => <tr key={post.id}><td><Link className="admin-content-title" to={`/admin/distribution/posts/${post.id}`} state={navigationState}>{post.title}</Link><p className="admin-content-subtitle">{post.body.slice(0, 72) || '尚未填写正文'}</p>
              <div className="distribution-tags">{post.tags.slice(0, 3).map(tag => <span className="admin-tag-pill" key={tag}>#{tag}</span>)}</div></td><td>{contentTypeLabels[post.content_type]}<small className="distribution-secondary">{goalLabels[post.promotion_goal]}</small></td>
              <td>{query.data.projects.find(project => project.id === post.project_id)?.title || '—'}</td><td><DistributionStatus status={post.status} /></td><td className="admin-content-date">{formatCollectionDate(post.updated_at)}</td>
              <td><div className="admin-row-actions"><Link className="admin-btn admin-btn-secondary admin-btn-sm" to={`/admin/distribution/posts/${post.id}`} state={navigationState} aria-label={`编辑内容：${post.title}`}>编辑</Link>
                {post.status === 'draft' && <button className="admin-btn admin-btn-danger admin-btn-sm" disabled={Boolean(action.pendingKey)} onClick={() => remove(post)} aria-label={`删除草稿：${post.title}`}><Trash2 size={14} /></button>}</div></td></tr>)}</tbody></table></div>
          <CollectionPagination total={view.total} page={view.page} pageCount={view.pageCount} pageSize={view.pageSize} onPage={page => view.updateFilter('page', page)} /></>}
    </section></div>;
}
