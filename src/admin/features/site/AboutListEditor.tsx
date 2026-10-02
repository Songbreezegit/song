import type { SiteSettingsRecord } from '../../../types/database';

export function AboutListEditor({ field, about, onChange }: {
  field: 'whatIDo' | 'techStack' | 'now' | 'path';
  about: SiteSettingsRecord['about'] | null;
  onChange: (value: SiteSettingsRecord['about']) => void;
}) {
  const rows = (about?.[field] || []) as unknown as Record<string, string | string[]>[];
  const fields = { whatIDo: ['title', 'desc'], techStack: ['category', 'items'], now: ['label', 'value'], path: ['year', 'event'] }[field];
  const update = (next: Record<string, string | string[]>[]) => onChange({
    greeting: '', role: '', bio: '', location: '', whatIDo: [], techStack: [], now: [], path: [], ...about, [field]: next,
  } as SiteSettingsRecord['about']);
  return <fieldset className="admin-form-group"><legend>{field}</legend>
    {rows.map((row, index) => <div key={index} className="admin-section-block">
      {fields.map(key => <label key={key} className="admin-label">{key}
        <input className="admin-input" value={Array.isArray(row[key]) ? row[key].join(', ') : row[key] || ''}
          onChange={e => update(rows.map((item, i) => i === index ? { ...item, [key]: key === 'items' ? e.target.value.split(',').map(v => v.trim()) : e.target.value } : item))} />
      </label>)}
      <button type="button" className="admin-btn admin-btn-secondary" onClick={() => update(rows.filter((_, i) => i !== index))}>删除条目</button>
    </div>)}
    <button type="button" className="admin-btn admin-btn-secondary" onClick={() => update([...rows, Object.fromEntries(fields.map(key => [key, key === 'items' ? [] : '']))])}>添加条目</button>
  </fieldset>;
}
