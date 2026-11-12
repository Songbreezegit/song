import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Save } from 'lucide-react';
import { fetchDistributionAccounts, getDistributionPost, saveDistributionPost } from '../../services/distributionService';
import { fetchAllProjects } from '../../services/projectService';
import { listMedia, type MediaItem } from '../../services/mediaService';
import type { DistributionAccountRecord, DistributionPostRecord } from '../../types/distribution';
import type { ProjectRecord } from '../../types/database';
import { useAdminQuery } from '../hooks/useAdminQuery';
import { useDistributionEditor } from '../features/distribution/useDistributionEditor';
import { contentTypeLabels, createPostEditorDraft, goalLabels, platformLabels, postStatusLabels, postToEditorDraft, serializePostEditorDraft, type DistributionPostEditorDraft } from '../features/distribution/distributionForm';
import { DistributionField, DistributionTabs } from '../features/distribution/DistributionChrome';
import { DistributionLeaveDialog } from '../features/distribution/DistributionLeaveDialog';
import { DistributionMediaPicker } from '../features/distribution/DistributionMediaPicker';
import { variantWorkspacePath } from '../features/distribution/variantWorkspace';
import { AdminEditorHeader } from '../components/AdminEditorChrome';
import { AdminFeedback } from '../components/AdminFeedback';
import { AdminLoading } from '../components/AdminLoading';
import { AdminQueryError } from '../components/AdminQueryError';

const config = { create: createPostEditorDraft, load: getDistributionPost, toDraft: postToEditorDraft,
  save: (id: string, draft: DistributionPostEditorDraft, version: number | null): Promise<DistributionPostRecord> => saveDistributionPost(id, serializePostEditorDraft(draft), version), listPath: '/admin/distribution/posts' };
const loadOptions = async () => {
  const [accounts, projects, media] = await Promise.all([fetchDistributionAccounts(), fetchAllProjects(), listMedia()]);
  return { accounts, projects, media };
};

export function AdminDistributionPostEditor() {
  const { id } = useParams();
  return <PostEditor key={id || 'new'} id={id} />;
}

function PostEditor({ id }: { id?: string }) {
  const editor = useDistributionEditor(id, config);
  const options = useAdminQuery(loadOptions, { accounts: [] as DistributionAccountRecord[], projects: [] as ProjectRecord[], media: [] as MediaItem[] }, '关联资料加载失败，请重试。');
  const { draft, setField } = editor;
  const disabled = editor.saving || options.loading || Boolean(options.error);
  const submit = (event: FormEvent) => { event.preventDefault(); if (!disabled) void editor.save(); };
  if (editor.loading) return <AdminLoading />;
  if (editor.error) return <><Link className="admin-btn admin-btn-secondary" to={editor.returnTo}>返回列表</Link><AdminQueryError error={editor.error} onRetry={editor.reload} /></>;
  return <div className="distribution-workspace admin-editor-workspace"><DistributionTabs />
    {editor.blockedNavigation && <DistributionLeaveDialog {...editor.blockedNavigation} isDirty={editor.isDirty} saving={editor.saving} />}
    <AdminEditorHeader title={editor.isNew ? '新建分发内容' : '编辑分发内容'} description="先准备内容源，再选择目标账号与素材。" backTo={editor.returnTo} isDirty={editor.isDirty} saving={editor.saving} lastSavedAt={editor.lastSavedAt}
      actions={<>
        {editor.data.record && <Link className="admin-btn admin-btn-secondary" to={variantWorkspacePath(editor.data.record.id)}>平台版本</Link>}
        <button type="submit" form="distribution-post-form" className="admin-btn admin-btn-primary" disabled={disabled}><Save size={15} />{editor.saving ? '正在保存…' : '保存内容'}</button>
      </>} />
    <AdminFeedback feedback={editor.feedback} /><AdminQueryError error={options.error} onRetry={options.reload} />
    {options.loading && <AdminLoading message="正在加载账号、项目和媒体…" />}
    <form id="distribution-post-form" onSubmit={submit}><fieldset className="admin-editor-fields" disabled={disabled}><div className="admin-editor-layout">
      <div><section className="admin-card"><div className="admin-card-header"><h2 className="admin-card-title">内容源</h2></div>
        <DistributionField id="distribution-post-title" label="标题 *"><input id="distribution-post-title" className="admin-input" value={draft.title} onChange={event => setField('title', event.target.value)} maxLength={200} required placeholder="给这份内容一个清晰的标题" /></DistributionField>
        <DistributionField id="distribution-post-body" label="正文"><textarea id="distribution-post-body" className="admin-textarea distribution-body-input" value={draft.body} onChange={event => setField('body', event.target.value)} rows={14} maxLength={100000} placeholder="记录要分享的故事、观点或产品进展" /></DistributionField>
        <DistributionField id="distribution-post-tags" label="标签" help="用中文或英文逗号分隔，最多 20 个，每个最多 50 字。"><input id="distribution-post-tags" className="admin-input" value={draft.tagsText} onChange={event => setField('tagsText', event.target.value)} aria-describedby="distribution-post-tags-help" placeholder="产品进展，独立开发，设计记录" /></DistributionField>
      </section><section className="admin-card"><div className="admin-card-header"><h2 className="admin-card-title">媒体素材</h2></div><DistributionMediaPicker items={options.data.media} selected={draft.media_ids} onChange={ids => setField('media_ids', ids)} /></section></div>
      <aside><section className="admin-card"><div className="admin-card-header"><h2 className="admin-card-title">内容配置</h2></div>
        <DistributionField id="distribution-post-type" label="内容类型"><select id="distribution-post-type" className="admin-select" value={draft.content_type} onChange={event => setField('content_type', event.target.value as typeof draft.content_type)}>{Object.entries(contentTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></DistributionField>
        <DistributionField id="distribution-post-project" label="关联项目"><select id="distribution-post-project" className="admin-select" value={draft.project_id || ''} onChange={event => setField('project_id', event.target.value || null)}><option value="">不关联项目</option>{draft.project_id && !options.data.projects.some(project => project.id === draft.project_id) && <option value={draft.project_id}>项目不可用，请重新选择</option>}{options.data.projects.map(project => <option key={project.id} value={project.id}>{project.title}</option>)}</select></DistributionField>
        <DistributionField id="distribution-post-goal" label="推广目标"><select id="distribution-post-goal" className="admin-select" value={draft.promotion_goal} onChange={event => setField('promotion_goal', event.target.value as typeof draft.promotion_goal)}>{Object.entries(goalLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></DistributionField>
        <DistributionField id="distribution-post-status" label="内容状态"><select id="distribution-post-status" className="admin-select" value={draft.status} onChange={event => setField('status', event.target.value as typeof draft.status)}>{Object.entries(postStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></DistributionField>
        <p className="admin-label-desc">待发布：内容已准备好，尚未实际发布。</p>
      </section><section className="admin-card"><div className="admin-card-header"><h2 className="admin-card-title">目标账号</h2><span className="admin-label-desc">{draft.account_ids.length} / 50</span></div>
        <div className="distribution-target-list">{options.data.accounts.filter(account => !account.archived_at || draft.account_ids.includes(account.id)).map(account => <label className="distribution-checkbox" key={account.id}>
          <input type="checkbox" checked={draft.account_ids.includes(account.id)} disabled={!draft.account_ids.includes(account.id) && (!account.is_enabled || Boolean(account.archived_at) || draft.account_ids.length >= 50)} onChange={event => setField('account_ids', ids => event.target.checked ? [...ids, account.id].sort() : ids.filter(value => value !== account.id))} />
          <span>{account.name}<small>{platformLabels[account.platform]}{account.archived_at ? ' · 已归档' : !account.is_enabled ? ' · 已停用' : ''}</small></span>
        </label>)}{draft.account_ids.filter(accountId => !options.data.accounts.some(account => account.id === accountId)).map(accountId => <label className="distribution-checkbox" key={accountId}><input type="checkbox" checked onChange={() => setField('account_ids', ids => ids.filter(value => value !== accountId))} />账号不可用，取消选择后移除</label>)}</div>
        {!options.data.accounts.some(account => account.is_enabled && !account.archived_at) && <p className="admin-label-desc">暂无启用账号。可先保存草稿，再到矩阵账号中添加。</p>}
      </section></aside>
    </div></fieldset></form></div>;
}
