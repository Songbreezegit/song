import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import type { SiteSettingsRecord } from '../../../types/database';

const listLabels = {
  whatIDo: { title: '我在做什么', description: '用工作方向和简短说明介绍你的专长。', fields: ['title', 'desc'] },
  techStack: { title: '技术栈', description: '按分类组织技术，多个技术名称用逗号分隔。', fields: ['category', 'items'] },
  now: { title: '个人近况', description: '补充个人档案里的当前状态。', fields: ['label', 'value'] },
  path: { title: '经历时间线', description: '按展示顺序记录年份和关键经历。', fields: ['year', 'event'] },
} as const;
const fieldLabels: Record<string, string> = { title: '方向名称', desc: '方向说明', category: '技术分类', items: '技术名称', label: '状态名称', value: '状态内容', year: '年份', event: '经历内容' };

export function AboutListEditor({ field, about, onChange }: {
  field: 'whatIDo' | 'techStack' | 'now' | 'path';
  about: SiteSettingsRecord['about'] | null;
  onChange: (value: SiteSettingsRecord['about']) => void;
}) {
  const rows = (about?.[field] || []) as unknown as Record<string, string | string[]>[];
  const config = listLabels[field];
  const update = (next: Record<string, string | string[]>[]) => onChange({
    greeting: '', role: '', bio: '', location: '', whatIDo: [], techStack: [], now: [], path: [], ...about, [field]: next,
  } as SiteSettingsRecord['about']);
  const move = (index: number, direction: number) => {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    update(next);
  };
  return <fieldset className="admin-about-list">
    <legend>{config.title} <span className="admin-label-desc">{rows.length} 项</span></legend>
    <p className="admin-label-desc">{config.description}</p>
    {rows.map((row, index) => <div key={index} className="admin-section-block">
      <div className="admin-section-header"><span className="admin-section-title">{config.title} #{index + 1}</span><div className="admin-editor-section-actions">
        <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => move(index, -1)} disabled={index === 0} aria-label={'上移' + config.title + '条目 ' + (index + 1)}><ChevronUp size={13} /></button>
        <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => move(index, 1)} disabled={index === rows.length - 1} aria-label={'下移' + config.title + '条目 ' + (index + 1)}><ChevronDown size={13} /></button>
        <button type="button" className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => update(rows.filter((_, i) => i !== index))} aria-label={'删除' + config.title + '条目 ' + (index + 1)}><Trash2 size={13} /></button>
      </div></div>
      {config.fields.map(key => <div key={key} className="admin-form-group"><label className="admin-label" htmlFor={'about-' + field + '-' + index + '-' + key}>{fieldLabels[key]}</label>
        <input id={'about-' + field + '-' + index + '-' + key} className="admin-input" value={Array.isArray(row[key]) ? row[key].join(',') : row[key] || ''}
          onChange={event => update(rows.map((item, i) => i === index ? { ...item, [key]: key === 'items' ? event.target.value.split(/[,，]/) : event.target.value } : item))} />
      </div>)}
    </div>)}
    {rows.length === 0 && <p className="admin-editor-note">尚未添加内容，可以稍后再完善。</p>}
    <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => update([...rows, Object.fromEntries(config.fields.map(key => [key, key === 'items' ? [] : '']))])}><Plus size={14} />添加{config.title}条目</button>
  </fieldset>;
}
