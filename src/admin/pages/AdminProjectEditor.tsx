import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Save, CheckCircle } from 'lucide-react';
import type { ContentStatus } from '../../types/database';
import type { Project } from '../../data/portfolioData';
import { AdminFeedback } from '../components/AdminFeedback';
import { AdminLoading } from '../components/AdminLoading';
import { AdminQueryError } from '../components/AdminQueryError';
import { projectCategories } from '../features/projects/projectForm';
import { useProjectEditor } from '../features/projects/useProjectEditor';
import { ProjectDetailsFields } from '../features/projects/ProjectDetailsFields';
import { ProjectCoverFields } from '../features/projects/ProjectCoverFields';

export function AdminProjectEditor() {
  const { id } = useParams<{ id: string }>();
  return <ProjectEditor key={id || 'new'} id={id} />;
}

function ProjectEditor({ id }: { id?: string }) {
  const editor = useProjectEditor(id);
  const { draft, setField, isNew, loading, saving, loadFailed, loadError, reload, feedback, uploadingCover, handleSubmit, handleAutoSlug } = editor;
  if (loading) return <AdminLoading message="正在加载项目数据..." />;
  if (loadError) return <><Link to="/admin/projects" className="admin-btn admin-btn-secondary">返回列表</Link><AdminQueryError error={loadError} onRetry={reload} /></>;

  return (
    <div>
      {/* Header Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link to="/admin/projects" className="admin-btn admin-btn-secondary admin-btn-sm">
            <ArrowLeft size={15} />
            <span>返回列表</span>
          </Link>
          <span style={{ fontSize: '14px', color: 'var(--admin-text-secondary)' }}>
            {isNew ? '新建项目' : `编辑：${draft.title || '未命名项目'}`}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            className="admin-btn admin-btn-secondary"
            onClick={() => handleSubmit('draft')}
            disabled={saving || uploadingCover || loadFailed}
          >
            <Save size={15} />
            <span>存为草稿</span>
          </button>
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={() => handleSubmit('published')}
            disabled={saving || uploadingCover || loadFailed}
          >
            {saving ? (
              <div className="admin-spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />
            ) : (
              <CheckCircle size={15} />
            )}
            <span>立即发布</span>
          </button>
        </div>
      </div>

      <AdminFeedback feedback={feedback} />

      <form onSubmit={(e: FormEvent) => { e.preventDefault(); void handleSubmit(); }}>
        <fieldset className="admin-editor-fields" disabled={saving || uploadingCover}>
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
                <label className="admin-label" htmlFor="project-title">项目名称 (Title) *</label>
                <input
                  id="project-title"
                  type="text"
                  className="admin-input"
                  placeholder="例如：LizhangApp"
                  value={draft.title}
                  onChange={(e) => setField('title', e.target.value)}
                  required
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-label" htmlFor="project-slug">
                  URL Slug (唯一标识) *
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    id="project-slug"
                    type="text"
                    className="admin-input"
                    placeholder="例如：lizhang"
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

            <div className="admin-grid-2">
              <div className="admin-form-group">
                <label className="admin-label" htmlFor="project-subtitle">副标题 (Subtitle)</label>
                <input
                  id="project-subtitle"
                  type="text"
                  className="admin-input"
                  placeholder="例如：礼金记账"
                  value={draft.subtitle}
                  onChange={(e) => setField('subtitle', e.target.value)}
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-label" htmlFor="project-tagline">一句话定位 (Tagline)</label>
                <input
                  id="project-tagline"
                  type="text"
                  className="admin-input"
                  placeholder="一款专为人情往来与礼金支出定制的 Android 原生应用"
                  value={draft.tagline}
                  onChange={(e) => setField('tagline', e.target.value)}
                />
              </div>
            </div>

            <div className="admin-grid-4">
              <div className="admin-form-group">
                <label className="admin-label" htmlFor="project-category">主分类</label>
                <select
                  id="project-category"
                  className="admin-select"
                  value={draft.category}
                  onChange={(e) => setField('category', e.target.value as Project['category'])}
                >
                  {projectCategories.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="admin-form-group">
                <label className="admin-label" htmlFor="project-category-label">分类展示标签</label>
                <input
                  id="project-category-label"
                  type="text"
                  className="admin-input"
                  placeholder="例如：Android / Compose"
                  value={draft.category_label}
                  onChange={(e) => setField('category_label', e.target.value)}
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-label" htmlFor="project-year">年份 (Year)</label>
                <input
                  id="project-year"
                  type="text"
                  className="admin-input"
                  placeholder="2026"
                  value={draft.year}
                  onChange={(e) => setField('year', e.target.value)}
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-label" htmlFor="project-status">发布状态</label>
                <select
                  id="project-status"
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

            <div className="admin-form-group" style={{ marginBottom: 0 }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={draft.featured}
                  onChange={(e) => setField('featured', e.target.checked)}
                />
                <span style={{ fontSize: '13px', fontWeight: 500 }}>设为首页精选项目 (Featured)</span>
              </label>
            </div>
          </div>

          <ProjectDetailsFields editor={editor} />
          <ProjectCoverFields editor={editor} />

          <button type="submit" className="admin-btn admin-btn-primary" disabled={saving || uploadingCover || loadFailed}>保存当前状态</button>
          {/* Save Bar */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
            <button
              type="button"
              className="admin-btn admin-btn-secondary"
              onClick={() => handleSubmit('draft')}
              disabled={saving || uploadingCover || loadFailed}
            >
              <Save size={15} />
              <span>存为草稿</span>
            </button>
            <button
              type="button"
              className="admin-btn admin-btn-primary"
              onClick={() => handleSubmit('published')}
              disabled={saving || uploadingCover || loadFailed}
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
