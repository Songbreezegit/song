import { Link } from 'react-router-dom';
import { Archive, ExternalLink, Plus, RefreshCw } from 'lucide-react';
import { archiveDistributionAccount, fetchDistributionAccounts } from '../../services/distributionService';
import { fetchAllProjects } from '../../services/projectService';
import { safeExternalUrl } from '../../lib/safeUrl';
import { useAdminQuery } from '../hooks/useAdminQuery';
import { useAdminAction } from '../hooks/useAdminAction';
import { useDistributionCollection } from '../features/distribution/useDistributionCollection';
import { DistributionEmpty, DistributionTabs } from '../features/distribution/DistributionChrome';
import { platformLabels } from '../features/distribution/distributionForm';
import { AdminPageHeader } from '../components/AdminPageHeader';
import { AdminFeedback } from '../components/AdminFeedback';
import { AdminLoading } from '../components/AdminLoading';
import { AdminQueryError } from '../components/AdminQueryError';
import { CollectionPagination, CollectionToolbar } from '../components/CollectionControls';
import type { DistributionAccountRecord } from '../../types/distribution';
import type { ProjectRecord } from '../../types/database';

const load = async () => { const [accounts, projects] = await Promise.all([fetchDistributionAccounts(), fetchAllProjects()]); return { accounts, projects }; };
export function AdminDistributionAccounts() {
  const query = useAdminQuery(load, { accounts: [] as DistributionAccountRecord[], projects: [] as ProjectRecord[] }, '矩阵账号加载失败，请重试。');
  const action = useAdminAction('归档失败，请重试。');
  const view = useDistributionCollection(query.data.accounts.map(account => ({ key: account.id, title: account.name, searchText: `${account.name} ${account.positioning} ${account.notes} ${account.profile_url}`,
    category: account.platform, updatedAt: account.updated_at, stage: account.archived_at ? 'archived' : account.is_enabled ? 'enabled' : 'disabled', projectId: account.project_id, account })), ['enabled', 'disabled', 'archived']);
  const navigationState = { returnTo: `/admin/distribution/accounts${view.search}` };
  const archive = (account: DistributionAccountRecord) => {
    if (!window.confirm(`归档账号「${account.name}」？已有内容的关联会保留，之后不能选择它作为新的目标账号。`)) return;
    void action.run(account.id, () => archiveDistributionAccount(account.id, account.version), { successMessage: '账号已归档。', onSuccess: saved => query.setData(previous => ({ ...previous, accounts: previous.accounts.map(row => row.id === saved.id ? saved : row) })) });
  };
  return <div className="distribution-workspace"><AdminPageHeader title="矩阵账号" description="整理各平台的账号资料、定位与关联项目。" actions={<>
    <button className="admin-btn admin-btn-secondary" disabled={query.loading || Boolean(action.pendingKey)} onClick={query.reload} aria-label="刷新矩阵账号"><RefreshCw size={15} />刷新</button>
    <Link className="admin-btn admin-btn-primary" to="/admin/distribution/accounts/new" state={navigationState}><Plus size={16} />新增账号</Link></>} /><DistributionTabs /><AdminFeedback feedback={action.feedback} />
    <section className="admin-card admin-collection-card" aria-label="矩阵账号列表">
      <div className="admin-status-tabs" role="group" aria-label="账号状态筛选">{[['', '全部'], ['enabled', '启用'], ['disabled', '停用'], ['archived', '已归档']].map(([stage, label]) => <button key={stage} className={`admin-status-tab${view.stage === stage ? ' is-active' : ''}`} aria-pressed={view.stage === stage} onClick={() => view.setFilter('stage', stage)}>{label}</button>)}</div>
      <CollectionToolbar label="矩阵账号" query={view.filters.query} onQuery={value => view.updateFilter('query', value)} category={view.filters.category} categories={Object.entries(platformLabels).map(([value, label]) => ({ value, label }))} categoryLabel="平台"
        onCategory={value => view.updateFilter('category', value)} sort={view.filters.sort} onSort={value => view.updateFilter('sort', value)} includeOrder={false} hasFilters={view.hasFilters} onClear={view.clearFilters} />
      {query.loading ? <AdminLoading /> : query.error ? <AdminQueryError error={query.error} onRetry={query.reload} /> : !query.data.accounts.length ? <DistributionEmpty title="先添加一个矩阵账号" description="保存账号主页与定位，方便为内容选择合适的目标。" to="/admin/distribution/accounts/new" action="新增账号" />
        : !view.total ? <DistributionEmpty title="没有匹配的账号" description="调整关键词、平台或状态筛选。" /> : <><div className="distribution-account-grid">{view.visible.map(({ account }) => {
          const url = safeExternalUrl(account.profile_url);
          return <article className="distribution-account-card" key={account.id}><div className="distribution-account-heading"><span className="distribution-platform">{platformLabels[account.platform]}</span><span className="admin-label-desc">{account.archived_at ? '已归档' : account.is_enabled ? '启用中' : '已停用'}</span></div>
            <h2><Link to={`/admin/distribution/accounts/${account.id}`} state={navigationState}>{account.name}</Link></h2><p className="distribution-secondary">{account.account_type === 'project' ? '项目官方' : '个人'}{account.project_id && ` · ${query.data.projects.find(project => project.id === account.project_id)?.title || '关联项目'}`}</p>
            <p className="distribution-account-position">{account.positioning || '尚未填写账号定位'}</p><div className="distribution-account-actions">
              <Link className="admin-btn admin-btn-secondary admin-btn-sm" to={`/admin/distribution/accounts/${account.id}`} state={navigationState}>{account.archived_at ? '查看' : '编辑'}</Link>
              {url && <a className="admin-btn admin-btn-secondary admin-btn-sm" href={url} target="_blank" rel="noreferrer">主页<ExternalLink size={13} /></a>}
              {!account.archived_at && <button className="admin-btn admin-btn-secondary admin-btn-sm" disabled={Boolean(action.pendingKey)} aria-label={`归档账号：${account.name}`} onClick={() => archive(account)}><Archive size={13} />归档</button>}
            </div></article>;
        })}</div><CollectionPagination total={view.total} page={view.page} pageCount={view.pageCount} pageSize={view.pageSize} onPage={page => view.updateFilter('page', page)} /></>}
    </section><p className="admin-editor-note">此处保存公开账号资料和使用配置。平台授权将在后续单独接入。</p></div>;
}
