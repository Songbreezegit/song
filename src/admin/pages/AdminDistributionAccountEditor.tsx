import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Save } from 'lucide-react';
import { fetchAllProjects } from '../../services/projectService';
import { getDistributionAccount, saveDistributionAccount } from '../../services/distributionService';
import type { ProjectRecord } from '../../types/database';
import { useAdminQuery } from '../hooks/useAdminQuery';
import { useDistributionEditor } from '../features/distribution/useDistributionEditor';
import { accountToDraft, createAccountDraft, platformLabels } from '../features/distribution/distributionForm';
import { DistributionField, DistributionTabs } from '../features/distribution/DistributionChrome';
import { DistributionLeaveDialog } from '../features/distribution/DistributionLeaveDialog';
import { AdminEditorHeader } from '../components/AdminEditorChrome';
import { AdminFeedback } from '../components/AdminFeedback';
import { AdminLoading } from '../components/AdminLoading';
import { AdminQueryError } from '../components/AdminQueryError';

const config = { create: createAccountDraft, load: getDistributionAccount, toDraft: accountToDraft, save: saveDistributionAccount, listPath: '/admin/distribution/accounts' };
export function AdminDistributionAccountEditor() {
  const { id } = useParams();
  return <AccountEditor key={id || 'new'} id={id} />;
}

function AccountEditor({ id }: { id?: string }) {
  const editor = useDistributionEditor(id, config);
  const projects = useAdminQuery<ProjectRecord[]>(fetchAllProjects, [], '项目列表加载失败，请重试。');
  const { draft, setField } = editor;
  const archived = Boolean(editor.data.record?.archived_at);
  const disabled = editor.saving || archived || projects.loading || Boolean(projects.error);
  const submit = (event: FormEvent) => { event.preventDefault(); if (!disabled) void editor.save(); };
  if (editor.loading) return <AdminLoading />;
  if (editor.error) return <><Link className="admin-btn admin-btn-secondary" to={editor.returnTo}>返回列表</Link><AdminQueryError error={editor.error} onRetry={editor.reload} /></>;
  return <div className="distribution-workspace admin-editor-workspace"><DistributionTabs />
    {editor.blockedNavigation && <DistributionLeaveDialog {...editor.blockedNavigation} isDirty={editor.isDirty} saving={editor.saving} />}
    <AdminEditorHeader title={editor.isNew ? '新增矩阵账号' : draft.name} description="记录账号资料，明确每个平台的内容方向。" backTo={editor.returnTo}
      isDirty={editor.isDirty} saving={editor.saving} lastSavedAt={editor.lastSavedAt} actions={<button className="admin-btn admin-btn-primary" type="submit" form="distribution-account-form" disabled={disabled}><Save size={15} />保存账号</button>} />
    <AdminFeedback feedback={editor.feedback} /><AdminQueryError error={projects.error} onRetry={projects.reload} />
    {archived && <p className="admin-alert admin-alert-info" role="status">账号已归档，保留已有内容关联。可在此查看资料。</p>}
    <form id="distribution-account-form" onSubmit={submit}><fieldset disabled={disabled} className="admin-editor-fields"><div className="admin-editor-layout">
      <section className="admin-card"><div className="admin-card-header"><h2 className="admin-card-title">账号资料</h2></div>
        <div className="admin-grid-2"><DistributionField id="distribution-account-platform" label="平台"><select id="distribution-account-platform" className="admin-select" value={draft.platform} onChange={event => setField('platform', event.target.value as typeof draft.platform)}>{Object.entries(platformLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></DistributionField>
          <DistributionField id="distribution-account-type" label="账号类型"><select id="distribution-account-type" className="admin-select" value={draft.account_type} onChange={event => setField('account_type', event.target.value as typeof draft.account_type)}><option value="personal">个人</option><option value="project">项目官方</option></select></DistributionField></div>
        <DistributionField id="distribution-account-name" label="账号名称 *"><input id="distribution-account-name" className="admin-input" value={draft.name} onChange={event => setField('name', event.target.value)} maxLength={100} required /></DistributionField>
        <DistributionField id="distribution-account-url" label="主页链接" help="填写 HTTP(S) 账号主页，可留空。"><input id="distribution-account-url" className="admin-input" type="url" value={draft.profile_url} onChange={event => setField('profile_url', event.target.value)} maxLength={2048} placeholder="https://" aria-describedby="distribution-account-url-help" /></DistributionField>
        <DistributionField id="distribution-account-positioning" label="账号定位"><textarea id="distribution-account-positioning" className="admin-textarea" value={draft.positioning} onChange={event => setField('positioning', event.target.value)} rows={4} maxLength={1000} placeholder="面向谁，主要分享什么内容" /></DistributionField>
        <DistributionField id="distribution-account-notes" label="备注"><textarea id="distribution-account-notes" className="admin-textarea" value={draft.notes} onChange={event => setField('notes', event.target.value)} rows={4} maxLength={5000} /></DistributionField>
      </section><aside><section className="admin-card"><div className="admin-card-header"><h2 className="admin-card-title">使用配置</h2></div>
        <DistributionField id="distribution-account-project" label="关联项目"><select id="distribution-account-project" className="admin-select" value={draft.project_id || ''} onChange={event => setField('project_id', event.target.value || null)}><option value="">不关联项目</option>{draft.project_id && !projects.data.some(project => project.id === draft.project_id) && <option value={draft.project_id}>项目不可用，请重新选择</option>}{projects.data.map(project => <option key={project.id} value={project.id}>{project.title}</option>)}</select></DistributionField>
        <label className="distribution-checkbox"><input type="checkbox" checked={draft.is_enabled} onChange={event => setField('is_enabled', event.target.checked)} />启用账号</label><p className="admin-label-desc">启用后可选择为新内容的目标账号。</p>
      </section><p className="admin-editor-note">这里只保存公开账号资料。新增账号后，可在内容库中为稿件选择目标账号。</p></aside>
    </div></fieldset></form></div>;
}
