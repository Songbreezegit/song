import { useCallback, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Layers, Plus, RefreshCw } from 'lucide-react';
import { createDistributionVariant } from '../../services/distributionVariantService';
import { AdminFeedback } from '../components/AdminFeedback';
import { AdminLoading } from '../components/AdminLoading';
import { AdminPageHeader } from '../components/AdminPageHeader';
import { AdminQueryError } from '../components/AdminQueryError';
import { DistributionStatus, DistributionTabs } from '../features/distribution/DistributionChrome';
import { platformLabels } from '../features/distribution/distributionForm';
import { variantReadOnlyReason } from '../features/distribution/variantModel';
import { loadVariantWorkspace, variantWorkspacePath } from '../features/distribution/variantWorkspace';
import { useAdminAction } from '../hooks/useAdminAction';
import { useAdminQuery } from '../hooks/useAdminQuery';
import '../features/distribution/variants.css';

export function AdminDistributionVariants() {
  const { id } = useParams();
  return <VariantWorkspace key={id} postId={id ?? ''} />;
}

function VariantWorkspace({ postId }: { postId: string }) {
  const load = useCallback(() => loadVariantWorkspace(postId), [postId]);
  const query = useAdminQuery<Awaited<ReturnType<typeof load>> | null>(load, null, '平台版本加载失败，请重试。');
  const action = useAdminAction('生成平台稿失败，请重试。');
  const requestIds = useRef(new Map<string, string>());
  const navigate = useNavigate();
  const base = variantWorkspacePath(postId);
  const workspace = query.data;

  const generate = (accountId: string) => {
    const requestId = requestIds.current.get(accountId) ?? crypto.randomUUID();
    requestIds.current.set(accountId, requestId);
    void action.run(accountId, () => createDistributionVariant(requestId, postId, accountId), {
      onSuccess: variant => navigate(`${base}/${variant.id}`),
    });
  };

  return <div className="distribution-workspace variant-workspace">
    <DistributionTabs />
    <AdminPageHeader title="平台版本" description={workspace ? `${workspace.source.title} · 内容源 v${workspace.source.version}` : '按目标账号准备独立稿件。'}
      actions={<>
        <Link className="admin-btn admin-btn-secondary" to={`/admin/distribution/posts/${postId}`}><ArrowLeft size={15} />返回内容源</Link>
        <button type="button" className="admin-btn admin-btn-secondary" disabled={query.loading || Boolean(action.pendingKey)} onClick={query.reload}><RefreshCw size={15} />刷新目标</button>
      </>} />
    <AdminFeedback feedback={action.feedback} />
    {query.loading ? <AdminLoading /> : query.error ? <AdminQueryError error={query.error} onRetry={query.reload} /> : workspace && <>
      <p className="variant-context"><Layers size={18} />每个账号拥有独立稿件。首次生成会复制已保存的内容源和素材顺序。</p>
      {renderGroup('当前目标', workspace.source.account_ids, '请先在内容源选择目标账号并保存。')}
      {renderGroup('历史平台稿', workspace.variants.filter(row => !workspace.source.account_ids.includes(row.account_id)).map(row => row.account_id), '暂无已移除目标的历史稿件。')}
    </>}
  </div>;

  function renderGroup(heading: string, ids: string[], empty: string) {
    if (!workspace) return null;
    return <section className="admin-card variant-target-section">
      <div className="admin-card-header"><h2 className="admin-card-title">{heading}</h2><span className="variant-counter">{ids.length}</span></div>
      {!ids.length ? <p className="admin-editor-note">{empty}</p> : <ul className="variant-target-list">
        {ids.map(id => {
          const account = workspace.accounts.find(item => item.id === id);
          const variant = workspace.variants.find(item => item.account_id === id);
          const reason = variantReadOnlyReason(workspace.source, account, variant);
          const platform = variant?.platform ?? account?.platform ?? 'other';
          const name = account?.name ?? '不可用账号';
          return <li className="variant-target" key={id}>
            <div className="variant-target-info">
              <div className="variant-meta"><span className="distribution-platform">{platformLabels[platform]}</span>{variant && <DistributionStatus status={variant.status} />}{reason && <span className="variant-badge">历史 / 只读</span>}</div>
              <h3>{name}</h3>
              <p>{variant ? <>{variant.title} · 稿件 v{variant.version}{variant.source_version < workspace.source.version && <span className="variant-stale"> · 源内容已更新</span>}</> : '尚未生成平台稿'}</p>
              {reason && <p>{reason}</p>}
            </div>
            {variant ? <Link className="admin-btn admin-btn-secondary" to={`${base}/${variant.id}`} aria-label={`${reason ? '查看平台稿' : '编辑平台稿'}：${name}`}>{reason ? '查看稿件' : '编辑稿件'}</Link>
              : <button type="button" className="admin-btn admin-btn-primary" disabled={Boolean(reason || action.pendingKey)} onClick={() => generate(id)} aria-label={`生成平台稿：${name}`}><Plus size={16} />{action.pendingKey === id ? '正在生成…' : '生成平台稿'}</button>}
          </li>;
        })}
      </ul>}
    </section>;
  }
}
