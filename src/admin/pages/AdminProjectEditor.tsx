import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Save, CheckCircle } from 'lucide-react';
import type { Project } from '../../data/portfolioData';
import { AdminFeedback } from '../components/AdminFeedback';
import { AdminLoading } from '../components/AdminLoading';
import { AdminQueryError } from '../components/AdminQueryError';
import { AdminEditorHeader, AdminEditorNavigation } from '../components/AdminEditorChrome';
import { AdminEditorPublishPanel } from '../components/AdminEditorPublishPanel';
import { getEditorSubmitStatus } from '../lib/editor';
import { projectCategories } from '../features/projects/projectForm';
import { useProjectEditor } from '../features/projects/useProjectEditor';
import { ProjectDetailsFields } from '../features/projects/ProjectDetailsFields';
import { ProjectCoverFields } from '../features/projects/ProjectCoverFields';

const sections = [
  { id: 'project-basics', label: '基本信息' }, { id: 'project-details', label: '项目介绍' },
  { id: 'project-features', label: '技术与功能' }, { id: 'project-cover', label: '封面与链接' },
  { id: 'project-publishing', label: '发布设置' },
];

export function AdminProjectEditor() {
  const { id } = useParams<{ id: string }>();
  return <ProjectEditor key={id || 'new'} id={id} />;
}

function ProjectEditor({ id }: { id?: string }) {
  const editor = useProjectEditor(id);
  const { draft, setField, isNew, loading, saving, loadFailed, loadError, reload, feedback, uploadingCover, handleSubmit, handleAutoSlug, returnTo } = editor;
  if (loading) return <AdminLoading message="正在加载项目数据..." />;
  if (loadError) return <><Link to={returnTo} className="admin-btn admin-btn-secondary">返回列表</Link><AdminQueryError error={loadError} onRetry={reload} /></>;
  const disabled = saving || uploadingCover || loadFailed;
  const submit = (event: FormEvent) => { event.preventDefault(); void handleSubmit(getEditorSubmitStatus(event)); };

  return <div className="admin-editor-workspace">
    <AdminEditorHeader title={isNew ? '新建项目' : draft.title || '编辑项目'} description="整理项目故事与亮点，让访客更容易了解你的作品。" backTo={returnTo}
      isDirty={editor.isDirty} saving={saving} lastSavedAt={editor.lastSavedAt} actions={<>
        {/* Enter in a single-line field must save the selected status, never default to the explicit draft action. */}
        <button type="submit" form="project-editor-form" className="admin-visually-hidden" tabIndex={-1} aria-hidden="true" disabled={disabled}>保存当前发布状态</button>
        <button type="submit" form="project-editor-form" name="save-status" value="draft" className="admin-btn admin-btn-secondary" disabled={disabled}><Save size={15} />存为草稿</button>
        <button type="submit" form="project-editor-form" name="save-status" value="published" className="admin-btn admin-btn-primary" disabled={disabled}><CheckCircle size={15} />保存并发布</button>
      </>} />
    <AdminFeedback feedback={feedback} />
    <AdminEditorNavigation sections={sections} />
    <form id="project-editor-form" onSubmit={submit}>
      <fieldset className="admin-editor-fields" disabled={saving || uploadingCover}>
        <div className="admin-editor-layout">
          <div className="admin-editor-main">
            <section className="admin-card admin-editor-section" id="project-basics">
              <div className="admin-card-header"><h3 className="admin-card-title">基本信息</h3><span className="admin-label-desc">先告诉访客，这是什么项目</span></div>
              <div className="admin-grid-2">
                <div className="admin-form-group"><label className="admin-label" htmlFor="project-title">项目名称 (Title) *</label><input id="project-title" type="text" className="admin-input" placeholder="例如：LizhangApp" value={draft.title} onChange={event => setField('title', event.target.value)} required /></div>
                <div className="admin-form-group"><label className="admin-label" htmlFor="project-slug">网址标识 (URL Slug) *</label><div className="admin-editor-inline">
                  <input id="project-slug" type="text" className="admin-input" placeholder="例如：lizhang" value={draft.slug} onChange={event => setField('slug', event.target.value)} aria-describedby="project-slug-help" required />
                  <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={handleAutoSlug} title="根据标题生成">自动生成</button>
                </div><p className="admin-label-desc" id="project-slug-help">公开链接中的唯一名称。修改已发布项目的标识会改变链接。</p></div>
              </div>
              <div className="admin-grid-2">
                <div className="admin-form-group"><label className="admin-label" htmlFor="project-subtitle">副标题</label><input id="project-subtitle" type="text" className="admin-input" placeholder="例如：礼金记账" value={draft.subtitle} onChange={event => setField('subtitle', event.target.value)} /></div>
                <div className="admin-form-group"><label className="admin-label" htmlFor="project-year">年份</label><input id="project-year" type="text" className="admin-input" placeholder="2026" value={draft.year} onChange={event => setField('year', event.target.value)} /></div>
              </div>
              <div className="admin-form-group"><label className="admin-label" htmlFor="project-tagline">一句话定位</label><input id="project-tagline" type="text" className="admin-input" placeholder="用一句话说明产品面向谁、解决什么问题" value={draft.tagline} onChange={event => setField('tagline', event.target.value)} /></div>
              <div className="admin-grid-2">
                <div className="admin-form-group"><label className="admin-label" htmlFor="project-category">主分类</label><select id="project-category" className="admin-select" value={draft.category} onChange={event => setField('category', event.target.value as Project['category'])}>{projectCategories.map(category => <option key={category.value} value={category.value}>{category.label}</option>)}</select></div>
                <div className="admin-form-group"><label className="admin-label" htmlFor="project-category-label">分类展示标签</label><input id="project-category-label" type="text" className="admin-input" placeholder="例如：Android / Compose" value={draft.category_label} onChange={event => setField('category_label', event.target.value)} /></div>
              </div>
              <label className="admin-editor-checkbox"><input type="checkbox" checked={draft.featured} onChange={event => setField('featured', event.target.checked)} /><span>设为首页精选项目 (Featured)</span></label>
            </section>
            <ProjectDetailsFields editor={editor} />
            <ProjectCoverFields editor={editor} />
          </div>
          <aside className="admin-editor-aside" aria-label="项目发布设置">
            <AdminEditorPublishPanel prefix="project" formId="project-editor-form" status={draft.status} sortOrder={draft.sort_order} onStatusChange={value => setField('status', value)} onSortOrderChange={value => setField('sort_order', value)} saving={saving} disabled={disabled}
              checks={[{ label: '填写项目名称', complete: Boolean(draft.title.trim()) }, { label: '设置唯一网址标识', complete: Boolean(draft.slug.trim()) }, { label: '准备卡片简介', complete: Boolean(draft.description.trim()) }, { label: '添加项目封面', complete: Boolean(draft.cover_image.trim()) }]} />
            <div className="admin-editor-note">存为草稿会隐藏已发布的项目。保存当前状态会保留你选择的发布状态。</div>
          </aside>
        </div>
      </fieldset>
    </form>
  </div>;
}
