import { useCallback, useMemo, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarPlus, RefreshCw, Save } from 'lucide-react';
import { getDistributionVariant, reviewDistributionVariantSource, saveDistributionVariant } from '../../services/distributionVariantService';
import { listMedia } from '../../services/mediaService';
import type { DistributionSourceReviewAction, DistributionVariantField, DistributionVariantInput } from '../../types/distribution';
import { AdminEditorHeader } from '../components/AdminEditorChrome';
import { AdminFeedback } from '../components/AdminFeedback';
import { AdminLoading } from '../components/AdminLoading';
import { AdminQueryError } from '../components/AdminQueryError';
import { DistributionField, DistributionStatus, DistributionTabs } from '../features/distribution/DistributionChrome';
import { DistributionLeaveDialog } from '../features/distribution/DistributionLeaveDialog';
import { contentTypeLabels, platformLabels, postStatusLabels } from '../features/distribution/distributionForm';
import { getDistributionPlatform } from '../features/distribution/platforms/registry';
import { newPublishTaskPath } from '../features/distribution/publishPaths';
import { useDistributionEditor } from '../features/distribution/useDistributionEditor';
import { VariantMediaPanel, VariantPreview, VariantRules, VariantSyncReview, VariantTags } from '../features/distribution/VariantPanels';
import { createVariantExport, formatVariantCopy, type VariantCopyPart } from '../features/distribution/variantExport';
import { compareVariantSource, variantMediaKinds, variantReadOnlyReason, variantToDraft } from '../features/distribution/variantModel';
import { loadVariantWorkspace, variantWorkspacePath } from '../features/distribution/variantWorkspace';
import { useAdminQuery } from '../hooks/useAdminQuery';
import '../features/distribution/variants.css';

const blank = (): DistributionVariantInput => ({ title: '', body: '', tags: [], content_type: 'image_text', status: 'draft', media: [] });

export function AdminDistributionVariantEditor() {
  const { id, variantId } = useParams();
  return <VariantEditor key={`${id}/${variantId}`} postId={id ?? ''} variantId={variantId ?? ''} />;
}

function VariantEditor({ postId, variantId }: { postId: string; variantId: string }) {
  const base = variantWorkspacePath(postId);
  const config = useMemo(() => ({
    create: blank, load: (id: string) => getDistributionVariant(postId, id), toDraft: variantToDraft, listPath: base,
    save: (id: string, draft: DistributionVariantInput, version: number | null) => {
      if (version === null) throw new Error('请先从目标账号生成平台稿。');
      return saveDistributionVariant(id, version, draft);
    },
  }), [postId, base]);
  const editor = useDistributionEditor(variantId, config);
  const load = useCallback(async () => {
    const [workspace, media] = await Promise.all([loadVariantWorkspace(postId), listMedia()]);
    return { ...workspace, media };
  }, [postId]);
  const options = useAdminQuery<Awaited<ReturnType<typeof load>> | null>(load, null, '内容源或媒体加载失败，请重试。');
  const record = editor.data.record;
  const data = options.data;
  if (editor.loading || (options.loading && !data)) return <AdminLoading />;
  if (editor.error || options.error && !data) return <div className="distribution-workspace">
    <Link className="admin-btn admin-btn-secondary" to={base}>返回平台版本</Link>
    <AdminQueryError error={editor.error ?? options.error} onRetry={() => {
      if (editor.error) void editor.reload();
      if (options.error) void options.reload();
    }} />
  </div>;
  if (!data || !record) return <AdminQueryError error="无法读取平台稿和内容源。" onRetry={options.reload} />;

  const { draft, setField } = editor;
  const account = data.accounts.find(item => item.id === record.account_id);
  const accountName = account?.name ?? '不可用账号';
  const profile = getDistributionPlatform(record.platform);
  const kinds = variantMediaKinds(data.media);
  const issues = profile.validate(draft, kinds);
  const readOnly = variantReadOnlyReason(data.source, account, record);
  const disabled = editor.saving || options.loading || Boolean(options.error || readOnly);
  const changes = compareVariantSource(data.source, record);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (disabled) return;
    const error = draft.status === 'ready' ? issues.find(issue => issue.severity === 'error') : null;
    if (error) editor.setFeedback({ type: 'error', message: error.message });
    else void editor.save();
  };
  const reviewSource = (action: DistributionSourceReviewAction, fields: DistributionVariantField[]) => {
    if (disabled || editor.isDirty) return Promise.resolve(false);
    const message = action === 'sync' ? '已同步选中的源内容。'
      : fields.length ? '已保留选中字段的平台稿内容。' : '已确认源版本，平台稿内容未变。';
    return editor.commit('sync', () => reviewDistributionVariantSource(action, record.id, record.version, data.source.version, fields), message);
  };
  const copy = async (part: VariantCopyPart) => {
    try {
      await navigator.clipboard.writeText(formatVariantCopy(record, part));
      editor.setFeedback({ type: 'success', message: `已复制稿件 v${record.version} 的文案。` });
    } catch {
      editor.setFeedback({ type: 'error', message: '剪贴板不可用。请在预览中选择文字，或导出已保存的稿件。' });
    }
  };
  const download = () => {
    const snapshot = createVariantExport(record, { id: record.account_id, name: accountName }, data.media);
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `distribution-${record.platform}-${record.id}-v${record.version}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    editor.setFeedback({ type: 'success', message: `已发起稿件 v${record.version} 的下载。` });
  };
  return <div className="distribution-workspace admin-editor-workspace variant-workspace">
    <DistributionTabs />
    {editor.blockedNavigation && <DistributionLeaveDialog {...editor.blockedNavigation} isDirty={editor.isDirty} saving={editor.saving} />}
    <AdminEditorHeader title={readOnly ? '查看平台稿' : '编辑平台稿'} description={`${profile.name} · ${accountName} · 稿件 v${record.version}`}
      backTo={base} isDirty={editor.isDirty} saving={editor.saving} lastSavedAt={editor.lastSavedAt}
      actions={<>
        {record.status === 'ready' && !editor.isDirty && !disabled &&
          <Link className="admin-btn admin-btn-secondary" to={newPublishTaskPath({ variant: record.id, post: postId })}><CalendarPlus size={15} />安排发布</Link>}
        <button type="button" className="admin-btn admin-btn-secondary" disabled={options.loading || editor.saving} onClick={options.reload}><RefreshCw size={15} />刷新内容源</button>
        {!readOnly && <button type="submit" form="distribution-variant-form" className="admin-btn admin-btn-primary" disabled={disabled}><Save size={15} />{editor.saving ? '正在保存…' : '保存平台稿'}</button>}
      </>} />
    <div className="variant-meta variant-editor-meta"><span className="distribution-platform">{profile.name}</span><DistributionStatus status={record.status} /><span>内容源 {data.source.title}</span></div>
    <nav className="variant-switcher" aria-label="切换账号平台稿">
      {data.variants.map(item => {
        const target = data.accounts.find(row => row.id === item.account_id);
        const name = target?.name ?? '不可用账号';
        return <Link key={item.id} className="variant-switch-link" aria-current={item.id === record.id ? 'page' : undefined}
          to={`${base}/${item.id}`}><small>{platformLabels[item.platform]}</small>{name}</Link>;
      })}
      <Link className="variant-switch-link" to={base}>全部目标</Link>
    </nav>
    <AdminFeedback feedback={editor.feedback} />
    <AdminQueryError error={options.error} onRetry={options.reload} />
    {options.loading && <AdminLoading message="正在重新读取内容源和媒体…" />}
    {readOnly && <p className="variant-context" role="status">{readOnly}</p>}
    <VariantSyncReview key={`${record.source_version}/${data.source.version}`} changes={changes} sourceVersion={data.source.version}
      savedVersion={record.source_version} items={data.media} disabled={disabled} dirty={editor.isDirty} onReview={reviewSource} />
    <div className="variant-editor-grid">
      <form id="distribution-variant-form" onSubmit={submit}><fieldset className="admin-editor-fields" disabled={disabled}>
        <section className="admin-card">
          <div className="admin-card-header"><h2 className="admin-card-title">独立文案</h2></div>
          <DistributionField id="variant-title" label="平台标题 *"><input id="variant-title" className="admin-input" maxLength={400}
            required value={draft.title} onChange={event => setField('title', event.target.value)} /></DistributionField>
          <DistributionField id="variant-body" label="平台正文"><textarea id="variant-body" className="admin-textarea distribution-body-input" maxLength={200000}
            rows={12} value={draft.body} onChange={event => setField('body', event.target.value)} /></DistributionField>
          <VariantTags tags={draft.tags} onChange={tags => setField('tags', tags)} />
          <div className="variant-form-grid">
            <DistributionField id="variant-type" label="内容类型"><select id="variant-type" className="admin-select" value={draft.content_type}
              onChange={event => setField('content_type', event.target.value as DistributionVariantInput['content_type'])}>
              {Object.entries(contentTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select></DistributionField>
            <DistributionField id="variant-status" label="平台稿状态"><select id="variant-status" className="admin-select" value={draft.status}
              onChange={event => setField('status', event.target.value as DistributionVariantInput['status'])}>
              {Object.entries(postStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select></DistributionField>
          </div>
          <p className="admin-label-desc">待发布表示已完成工作区准备，可交由人工发布。</p>
        </section>
        <VariantMediaPanel media={draft.media} items={data.media} kinds={kinds} ratios={profile.ratios} onChange={media => setField('media', media)} />
      </fieldset></form>
      <aside className="variant-inspection">
        <VariantRules profile={profile} issues={issues} />
        <VariantPreview saved={record} draft={draft} profile={profile} accountName={accountName} items={data.media}
          disabled={editor.saving || Boolean(options.error)} onCopy={part => void copy(part)} onExport={download} />
      </aside>
    </div>
  </div>;
}
