import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Save, CheckCircle, Plus } from 'lucide-react';
import type { Article } from '../../data/portfolioData';
import { AdminFeedback } from '../components/AdminFeedback';
import { AdminLoading } from '../components/AdminLoading';
import { AdminQueryError } from '../components/AdminQueryError';
import { AdminEditorHeader, AdminEditorNavigation } from '../components/AdminEditorChrome';
import { AdminEditorPublishPanel } from '../components/AdminEditorPublishPanel';
import { getEditorSubmitStatus } from '../lib/editor';
import { articleCategories } from '../features/articles/articleForm';
import { useArticleEditor } from '../features/articles/useArticleEditor';
import { ArticleSectionsEditor } from '../features/articles/ArticleSectionsEditor';

const sections = [{ id: 'article-basics', label: '文章信息' }, { id: 'article-summary', label: '摘要与导语' }, { id: 'article-sections', label: '正文小节' }, { id: 'article-publishing', label: '发布设置' }];

export function AdminArticleEditor() {
  const { id } = useParams<{ id: string }>();
  return <ArticleEditor key={id || 'new'} id={id} />;
}

function ArticleEditor({ id }: { id?: string }) {
  const editor = useArticleEditor(id);
  const { draft, setField, isNew, loading, saving, loadFailed, loadError, reload, feedback, handleSubmit, handleAutoSlug, returnTo,
    newTagInput, setNewTagInput, handleAddTag, handleRemoveTag } = editor;
  if (loading) return <AdminLoading message="正在加载文章数据..." />;
  if (loadError) return <><Link to={returnTo} className="admin-btn admin-btn-secondary">返回列表</Link><AdminQueryError error={loadError} onRetry={reload} /></>;
  const disabled = saving || loadFailed;
  const submit = (event: FormEvent) => { event.preventDefault(); void handleSubmit(getEditorSubmitStatus(event)); };

  return <div className="admin-editor-workspace">
    <AdminEditorHeader title={isNew ? '新建文章' : draft.title || '编辑文章'} description="从摘要到正文分步编写，整理好内容后再发布。" backTo={returnTo} isDirty={editor.isDirty} saving={saving} lastSavedAt={editor.lastSavedAt} actions={<>
      {/* Enter in a single-line field must save the selected status, never default to the explicit draft action. */}
      <button type="submit" form="article-editor-form" className="admin-visually-hidden" tabIndex={-1} aria-hidden="true" disabled={disabled}>保存当前发布状态</button>
      <button type="submit" form="article-editor-form" name="save-status" value="draft" className="admin-btn admin-btn-secondary" disabled={disabled}><Save size={15} />存为草稿</button>
      <button type="submit" form="article-editor-form" name="save-status" value="published" className="admin-btn admin-btn-primary" disabled={disabled}><CheckCircle size={15} />保存并发布</button>
    </>} />
    <AdminFeedback feedback={feedback} />
    <AdminEditorNavigation sections={sections} />
    <form id="article-editor-form" onSubmit={submit}>
      <fieldset className="admin-editor-fields" disabled={saving}>
        <div className="admin-editor-layout">
          <div className="admin-editor-main">
            <section className="admin-card admin-editor-section" id="article-basics">
              <div className="admin-card-header"><h3 className="admin-card-title">文章信息</h3><span className="admin-label-desc">标题、分类与展示标签</span></div>
              <div className="admin-form-group"><label className="admin-label" htmlFor="article-title">文章标题 *</label><input id="article-title" type="text" className="admin-input" placeholder="例如：做产品之前先想清楚问题" value={draft.title} onChange={event => setField('title', event.target.value)} required /></div>
              <div className="admin-form-group"><label className="admin-label" htmlFor="article-subtitle">副标题</label><input id="article-subtitle" type="text" className="admin-input" placeholder="补充标题，让读者知道文章讨论什么" value={draft.subtitle} onChange={event => setField('subtitle', event.target.value)} /></div>
              <div className="admin-form-group"><label className="admin-label" htmlFor="article-slug">网址标识 (URL Slug) *</label><div className="admin-editor-inline"><input id="article-slug" type="text" className="admin-input" placeholder="例如：think-before-code" value={draft.slug} onChange={event => setField('slug', event.target.value)} aria-describedby="article-slug-help" required /><button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={handleAutoSlug} title="根据标题生成">自动生成</button></div><p className="admin-label-desc" id="article-slug-help">文章链接中的唯一名称。修改已发布文章的标识会改变链接。</p></div>
              <div className="admin-grid-2">
                <div className="admin-form-group"><label className="admin-label" htmlFor="article-category">分类显示名称</label><input id="article-category" type="text" className="admin-input" placeholder="例如：思考 / 前端 / 安全" value={draft.category} onChange={event => setField('category', event.target.value)} /></div>
                <div className="admin-form-group"><label className="admin-label" htmlFor="article-cat-slug">分类分组标识</label><select id="article-cat-slug" className="admin-select" value={draft.category_slug} onChange={event => setField('category_slug', event.target.value as Article['categorySlug'])}>{articleCategories.map(category => <option key={category.value} value={category.value}>{category.label}</option>)}</select></div>
              </div>
              <div className="admin-form-group"><label className="admin-label" htmlFor="article-tags">标签</label><div className="admin-editor-inline"><input id="article-tags" type="text" className="admin-input" placeholder="输入标签名，按回车添加" value={newTagInput} onChange={event => setNewTagInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); handleAddTag(); } }} /><button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={handleAddTag} disabled={!newTagInput.trim()}><Plus size={14} />添加标签</button></div><div className="admin-editor-tag-list">{draft.tags.map((tag, index) => <span key={index} className="admin-tag-pill">#{tag}<button type="button" className="admin-tag-remove" aria-label={'移除标签 ' + tag} onClick={() => handleRemoveTag(index)}>×</button></span>)}{!draft.tags.length && <span className="admin-label-desc">尚未添加标签</span>}</div></div>
            </section>
            <section className="admin-card admin-editor-section" id="article-summary">
              <div className="admin-card-header"><h3 className="admin-card-title">摘要与导语</h3></div>
              <div className="admin-form-group"><label className="admin-label" htmlFor="article-excerpt">卡片摘要 (Excerpt)</label><textarea id="article-excerpt" className="admin-textarea" placeholder="在文章列表展示的一两句话，帮助读者决定是否继续阅读" value={draft.excerpt} onChange={event => setField('excerpt', event.target.value)} rows={3} /><p className="admin-label-desc">{draft.excerpt.length} 字 · 显示在文章卡片</p></div>
              <div className="admin-form-group"><label className="admin-label" htmlFor="article-lead">全文导语 (Lead Paragraph)</label><textarea id="article-lead" className="admin-textarea" placeholder="正文开头的重点引导段落" value={draft.content.lead} onChange={event => { const lead = event.target.value; setField('content', current => ({ ...current, lead })); }} rows={4} /><p className="admin-label-desc">显示在文章正文的开头，与列表摘要分别设置。</p></div>
            </section>
            <ArticleSectionsEditor sections={draft.content.sections} onChange={next => setField('content', current => ({ ...current, sections: next }))} />
          </div>
          <aside className="admin-editor-aside" aria-label="文章发布设置">
            <AdminEditorPublishPanel prefix="article" formId="article-editor-form" status={draft.status} sortOrder={draft.sort_order} onStatusChange={value => setField('status', value)} onSortOrderChange={value => setField('sort_order', value)} saving={saving} disabled={disabled}
              checks={[{ label: '填写文章标题', complete: Boolean(draft.title.trim()) }, { label: '设置唯一网址标识', complete: Boolean(draft.slug.trim()) }, { label: '准备卡片摘要', complete: Boolean(draft.excerpt.trim()) }, { label: '正文 ' + draft.content.sections.length + ' 个小节', complete: draft.content.sections.some(section => Boolean(section.body?.some(text => text.trim()) || section.code?.snippet?.trim() || section.quote?.trim() || section.table || section.callout?.text?.trim())) }]} />
            <section className="admin-card"><div className="admin-card-header"><h3 className="admin-card-title">阅读与归档</h3></div>
              <div className="admin-form-group"><label className="admin-label" htmlFor="article-date">发布日期</label><input id="article-date" type="text" className="admin-input" placeholder="2026.09.02" value={draft.date} onChange={event => setField('date', event.target.value)} /></div>
              <div className="admin-grid-2"><div className="admin-form-group"><label className="admin-label" htmlFor="article-read-time">阅读时长</label><input id="article-read-time" type="text" className="admin-input" placeholder="5 min" value={draft.read_time} onChange={event => setField('read_time', event.target.value)} /></div><div className="admin-form-group"><label className="admin-label" htmlFor="article-year">归档年份</label><input id="article-year" type="text" className="admin-input" placeholder="2026" value={draft.year} onChange={event => setField('year', event.target.value)} /></div></div>
            </section>
            <div className="admin-editor-note">存为草稿会隐藏已发布的文章。保存当前状态会保留你选择的发布状态。</div>
          </aside>
        </div>
      </fieldset>
    </form>
  </div>;
}
