import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Save, CheckCircle, Plus } from 'lucide-react';
import type { ContentStatus } from '../../types/database';
import type { Article } from '../../data/portfolioData';
import { AdminFeedback } from '../components/AdminFeedback';
import { AdminLoading } from '../components/AdminLoading';
import { AdminQueryError } from '../components/AdminQueryError';
import { articleCategories } from '../features/articles/articleForm';
import { useArticleEditor } from '../features/articles/useArticleEditor';
import { ArticleSectionsEditor } from '../features/articles/ArticleSectionsEditor';

export function AdminArticleEditor() {
  const { id } = useParams<{ id: string }>();
  return <ArticleEditor key={id || 'new'} id={id} />;
}

function ArticleEditor({ id }: { id?: string }) {
  const editor = useArticleEditor(id);
  const { draft, setField, isNew, loading, saving, loadFailed, loadError, reload, feedback, handleSubmit, handleAutoSlug,
    newTagInput, setNewTagInput, handleAddTag, handleRemoveTag } = editor;
  if (loading) return <AdminLoading message="正在加载文章数据..." />;
  if (loadError) return <><Link to="/admin/articles" className="admin-btn admin-btn-secondary">返回列表</Link><AdminQueryError error={loadError} onRetry={reload} /></>;

  return (
    <div>
      {/* Header Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link to="/admin/articles" className="admin-btn admin-btn-secondary admin-btn-sm">
            <ArrowLeft size={15} />
            <span>返回列表</span>
          </Link>
          <span style={{ fontSize: '14px', color: 'var(--admin-text-secondary)' }}>
            {isNew ? '新建文章' : `编辑：${draft.title || '未命名文章'}`}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            className="admin-btn admin-btn-secondary"
            onClick={() => handleSubmit('draft')}
            disabled={saving || loadFailed}
          >
            <Save size={15} />
            <span>存为草稿</span>
          </button>
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={() => handleSubmit('published')}
            disabled={saving || loadFailed}
          >
            {saving ? (
              <div className="admin-spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />
            ) : (
              <CheckCircle size={15} />
            )}
            <span>保存并发布</span>
          </button>
        </div>
      </div>

      <AdminFeedback feedback={feedback} />

      <form onSubmit={(e: FormEvent) => { e.preventDefault(); void handleSubmit(); }}>
        <fieldset className="admin-editor-fields" disabled={saving}>
          <div className="admin-form-group">
            <label className="admin-label" htmlFor="sort-order">Sort Order</label>
            <input id="sort-order" className="admin-input" type="number" step="1" value={draft.sort_order} onChange={(e) => setField('sort_order', e.target.valueAsNumber)} />
          </div>
          {/* 1. Basic Information */}
          <div className="admin-card">
            <div className="admin-card-header">
              <h3 className="admin-card-title">基本信息 (Basic Information)</h3>
            </div>

            <div className="admin-grid-2">
              <div className="admin-form-group">
                <label className="admin-label" htmlFor="article-title">文章标题 *</label>
                <input
                  id="article-title"
                  type="text"
                  className="admin-input"
                  placeholder="例如：做产品之前先想清楚问题"
                  value={draft.title}
                  onChange={(e) => setField('title', e.target.value)}
                  required
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-label" htmlFor="article-slug">URL Slug *</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    id="article-slug"
                    type="text"
                    className="admin-input"
                    placeholder="例如：think-before-code"
                    value={draft.slug}
                    onChange={(e) => setField('slug', e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="admin-btn admin-btn-secondary admin-btn-sm"
                    onClick={handleAutoSlug}
                    title="根据标题生成"
                  >
                    自动生成
                  </button>
                </div>
              </div>
            </div>

            <div className="admin-form-group">
              <label className="admin-label" htmlFor="article-subtitle">副标题</label>
              <input
                id="article-subtitle"
                type="text"
                className="admin-input"
                placeholder="探讨真实需求与代码实现的边界，拒绝伪需求陷阱"
                value={draft.subtitle}
                onChange={(e) => setField('subtitle', e.target.value)}
              />
            </div>

            <div className="admin-grid-4">
              <div className="admin-form-group">
                <label className="admin-label" htmlFor="article-category">分类显示名称</label>
                <input
                  id="article-category"
                  type="text"
                  className="admin-input"
                  placeholder="例如：思考 / 前端 / 安全"
                  value={draft.category}
                  onChange={(e) => setField('category', e.target.value)}
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-label" htmlFor="article-cat-slug">分类分组标识</label>
                <select
                  id="article-cat-slug"
                  className="admin-select"
                  value={draft.category_slug}
                  onChange={(e) => setField('category_slug', e.target.value as Article['categorySlug'])}
                >
                  {articleCategories.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="admin-form-group">
                <label className="admin-label" htmlFor="article-date">发布日期</label>
                <input
                  id="article-date"
                  type="text"
                  className="admin-input"
                  placeholder="2026.09.02"
                  value={draft.date}
                  onChange={(e) => setField('date', e.target.value)}
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-label" htmlFor="article-status">发布状态</label>
                <select
                  id="article-status"
                  className="admin-select"
                  value={draft.status}
                  onChange={(e) => setField('status', e.target.value as ContentStatus)}
                >
                  <option value="draft">草稿 (Draft)</option>
                  <option value="published">已发布 (Published)</option>
                  <option value="archived">已归档 (Archived)</option>
                </select>
              </div>
            </div>

            <div className="admin-grid-2">
              <div className="admin-form-group">
                <label className="admin-label" htmlFor="article-read-time">预计阅读时间</label>
                <input
                  id="article-read-time"
                  type="text"
                  className="admin-input"
                  placeholder="3 min"
                  value={draft.read_time}
                  onChange={(e) => setField('read_time', e.target.value)}
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-label" htmlFor="article-year">归档年份</label>
                <input
                  id="article-year"
                  type="text"
                  className="admin-input"
                  placeholder="2026"
                  value={draft.year}
                  onChange={(e) => setField('year', e.target.value)}
                />
              </div>
            </div>

            {/* Tags */}
            <div className="admin-form-group" style={{ marginBottom: 0 }}>
              <label className="admin-label">标签 (Tags)</label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                <input
                  type="text"
                  className="admin-input"
                  placeholder="输入标签名..."
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                />
                <button
                  type="button"
                  className="admin-btn admin-btn-secondary admin-btn-sm"
                  onClick={handleAddTag}
                >
                  <Plus size={14} />
                  <span>添加标签</span>
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {draft.tags.map((tag, idx) => (
                  <span key={idx} className="admin-tag-pill">
                    #{tag}
                    <button
                      type="button"
                      className="admin-tag-remove"
                      onClick={() => handleRemoveTag(idx)}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* 2. Lead & Excerpt */}
          <div className="admin-card">
            <div className="admin-card-header">
              <h3 className="admin-card-title">摘要与导语 (Excerpt & Lead)</h3>
            </div>

            <div className="admin-form-group">
              <label className="admin-label" htmlFor="article-excerpt">卡片摘要 (Excerpt)</label>
              <textarea
                id="article-excerpt"
                className="admin-textarea"
                placeholder="在文章卡片列表展示的一两句摘要..."
                value={draft.excerpt}
                onChange={(e) => setField('excerpt', e.target.value)}
                rows={2}
              />
            </div>

            <div className="admin-form-group" style={{ marginBottom: 0 }}>
              <label className="admin-label" htmlFor="article-lead">全文导语 (Lead Paragraph)</label>
              <textarea
                id="article-lead"
                className="admin-textarea"
                placeholder="文章正文开头的重点引导段落（以加大字体呈现）..."
                value={draft.content.lead}
                onChange={(e) => setField('content', { ...draft.content, lead: e.target.value })}
                rows={3}
              />
            </div>
          </div>

          <ArticleSectionsEditor sections={draft.content.sections} onChange={sections => setField('content', { ...draft.content, sections })} />

          <button type="submit" className="admin-btn admin-btn-primary" disabled={saving || loadFailed}>保存当前状态</button>
          {/* Save Bar */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
            <button
              type="button"
              className="admin-btn admin-btn-secondary"
              onClick={() => handleSubmit('draft')}
              disabled={saving || loadFailed}
            >
              <Save size={15} />
              <span>存为草稿</span>
            </button>
            <button
              type="button"
              className="admin-btn admin-btn-primary"
              onClick={() => handleSubmit('published')}
              disabled={saving || loadFailed}
            >
              {saving ? (
                <div className="admin-spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />
              ) : (
                <CheckCircle size={15} />
              )}
              <span>保存并发布</span>
            </button>
          </div>
        </fieldset>
      </form>
    </div>
  );
}
