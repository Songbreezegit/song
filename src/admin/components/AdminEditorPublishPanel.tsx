import { CheckCircle2, Circle, Save } from 'lucide-react';
import type { ContentStatus } from '../../types/database';

export function AdminEditorPublishPanel({ prefix, formId, status, sortOrder, onStatusChange, onSortOrderChange, checks, saving, disabled }: {
  prefix: string;
  formId: string;
  status: ContentStatus;
  sortOrder: number;
  onStatusChange: (status: ContentStatus) => void;
  onSortOrderChange: (value: number) => void;
  checks: { label: string; complete: boolean }[];
  saving: boolean;
  disabled: boolean;
}) {
  return <section className="admin-card admin-editor-publish-panel admin-editor-section" id={`${prefix}-publishing`}>
    <div className="admin-card-header"><h3 className="admin-card-title">发布与排序</h3></div>
    <div className="admin-form-group"><label className="admin-label" htmlFor={`${prefix}-status`}>发布状态</label>
      <select id={`${prefix}-status`} className="admin-select" value={status} onChange={event => onStatusChange(event.target.value as ContentStatus)}>
        <option value="draft">草稿 · 仅后台可见</option><option value="published">已发布 · 网站可见</option><option value="archived">已归档 · 网站隐藏</option>
      </select>
    </div>
    <div className="admin-form-group"><label className="admin-label" htmlFor="sort-order">显示顺序 (Sort Order)</label>
      <input id="sort-order" className="admin-input" type="number" step="1" value={sortOrder} onChange={event => onSortOrderChange(event.target.valueAsNumber)} />
      <p className="admin-label-desc">数字越小，列表中的位置越靠前。</p>
    </div>
    <ul className="admin-editor-checklist" aria-label="内容完善提示">{checks.map(check => <li key={check.label} data-complete={check.complete}>{check.complete ? <CheckCircle2 size={15} /> : <Circle size={15} />}<span>{check.label}</span></li>)}</ul>
    <p className="admin-editor-note">以上是内容完善建议。保存会检查标题、网址标识和有效排序值。</p>
    <button type="submit" form={formId} className="admin-btn admin-btn-primary" disabled={disabled}><Save size={15} />{saving ? '正在保存…' : '保存当前状态'}</button>
  </section>;
}
