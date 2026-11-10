import { Link } from 'react-router-dom';
import { ArrowRight, Clock, FileEdit, Plus, RefreshCw, Users } from 'lucide-react';
import { fetchDistributionOverview } from '../../services/distributionService';
import { useAdminQuery } from '../hooks/useAdminQuery';
import { AdminPageHeader } from '../components/AdminPageHeader';
import { AdminQueryError } from '../components/AdminQueryError';
import { AdminLoading } from '../components/AdminLoading';
import { DistributionEmpty, DistributionStatus, DistributionTabs } from '../features/distribution/DistributionChrome';
import { contentTypeLabels } from '../features/distribution/distributionForm';
import { formatCollectionDate } from '../lib/collection';
import type { DistributionOverview } from '../../types/distribution';

const empty: DistributionOverview = { accounts: 0, drafts: 0, ready: 0, recent: [] };
export function AdminDistribution() {
  const query = useAdminQuery(fetchDistributionOverview, empty, '分发概览加载失败，请重试。');
  const metrics = [{ label: '已管理账号', value: query.data.accounts, to: 'accounts', Icon: Users, detail: '包含停用账号，不含已归档账号' },
    { label: '内容草稿', value: query.data.drafts, to: 'posts?stage=draft', Icon: FileEdit, detail: '继续整理文案与素材' },
    { label: '待发布内容', value: query.data.ready, to: 'posts?stage=ready', Icon: Clock, detail: '已准备，等待后续发布安排' }];
  return <div className="distribution-workspace">
    <AdminPageHeader title="内容分发" description="从一份内容出发，整理账号、文案与素材。" actions={<>
      <button className="admin-btn admin-btn-secondary" onClick={query.reload} disabled={query.loading} aria-label="刷新分发概览"><RefreshCw size={15} />刷新</button>
      <Link className="admin-btn admin-btn-primary" to="/admin/distribution/posts/new"><Plus size={16} />新建内容</Link></>} />
    <DistributionTabs />
    <AdminQueryError error={query.error} onRetry={query.reload} />
    <div className="distribution-metrics" aria-label="分发统计">{metrics.map(({ label, value, to, Icon, detail }) =>
      <Link className="distribution-metric" key={label} to={`/admin/distribution/${to}`}><span><Icon size={17} />{label}</span>
        <strong data-testid={`distribution-${to.split('?')[0]}-${to.includes('draft') ? 'drafts' : to.includes('ready') ? 'ready' : 'total'}`}>{query.loading ? '…' : query.error ? '—' : value}</strong><small>{detail}</small></Link>)}
    </div>
    <section className="admin-card"><div className="admin-card-header"><div><h2 className="admin-card-title">最近编辑内容</h2><p className="admin-card-description">接着上一次的想法，继续准备。</p></div>
      <Link className="admin-btn admin-btn-secondary admin-btn-sm" to="/admin/distribution/posts">全部内容<ArrowRight size={14} /></Link></div>
      {query.loading ? <AdminLoading /> : query.error ? null : !query.data.recent.length ? <DistributionEmpty title="开始准备第一份内容" description="创建一份草稿，再为它选择推广目标和已有素材。" to="/admin/distribution/posts/new" action="新建内容" />
        : <div className="admin-recent-list">{query.data.recent.map(post => <Link className="admin-recent-item" to={`/admin/distribution/posts/${post.id}`} key={post.id}>
          <span className="admin-content-icon"><FileEdit size={20} /></span><span className="admin-recent-copy"><strong>{post.title}</strong><span>{contentTypeLabels[post.content_type]} · {formatCollectionDate(post.updated_at)}</span></span><DistributionStatus status={post.status} /><ArrowRight size={16} /></Link>)}</div>}
    </section>
    <p className="admin-editor-note">“待发布”表示内容已准备好。本阶段在内容库中整理资料，实际发布由后续工作流处理。</p>
  </div>;
}
