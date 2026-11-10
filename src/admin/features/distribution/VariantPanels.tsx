import { useState } from 'react';
import { ArrowDown, ArrowUp, Copy, Download, Plus, X } from 'lucide-react';
import { safeImageUrl } from '../../../lib/safeUrl';
import type { MediaItem } from '../../../services/mediaService';
import { distributionAspectRatios, type DistributionMediaKind, type DistributionRuleIssue, type DistributionVariantField, type DistributionVariantInput, type DistributionVariantMedia, type DistributionVariantRecord } from '../../../types/distribution';
import { DistributionMediaPicker } from './DistributionMediaPicker';
import { contentTypeLabels } from './distributionForm';
import type { DistributionPlatformProfile } from './platforms/registry';
import type { VariantCopyPart } from './variantExport';
import { compareVariantSource, moveVariantMedia, replaceVariantSelection, variantFieldLabels } from './variantModel';

export function VariantTags({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const add = () => {
    const tag = value.trim();
    if (!tag) return;
    if ([...tag].length > 50 || tag.includes('\0')) { setError('标签最多 50 个字符。'); return; }
    if (tags.length >= 20 || tags.includes(tag)) { setError('标签最多 20 个，且不能重复。'); return; }
    onChange([...tags, tag]);
    setValue('');
    setError('');
  };
  return <div className="admin-form-field">
    <label className="admin-label" htmlFor="variant-tag">标签</label>
    <p className="admin-label-desc" id="variant-tag-help">输入单个标签后按回车添加，标签内可保留逗号。{tags.length} / 20</p>
    <div className="distribution-tags">
      {tags.map(tag => <span className="admin-tag-pill" key={tag}>#{tag}<button type="button" className="admin-tag-remove"
        aria-label={`移除标签 ${tag}`} onClick={() => onChange(tags.filter(current => current !== tag))}><X size={12} /></button></span>)}
    </div>
    <div className="variant-inline">
      <input id="variant-tag" className="admin-input" aria-describedby="variant-tag-help" value={value} maxLength={100}
        onChange={event => { setValue(event.target.value); setError(''); }}
        onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); add(); } }} />
      <button type="button" className="admin-btn admin-btn-secondary" onClick={add} disabled={!value.trim()}><Plus size={14} />添加标签</button>
    </div>
    {error && <p className="admin-label-desc" role="alert">{error}</p>}
  </div>;
}

export function VariantMediaPanel({ media, items, kinds, ratios, onChange }: {
  media: DistributionVariantMedia[]; items: MediaItem[]; kinds: ReadonlyMap<string, DistributionMediaKind>;
  ratios: DistributionPlatformProfile['ratios']; onChange: (media: DistributionVariantMedia[]) => void;
}) {
  const update = (id: string, change: Partial<DistributionVariantMedia>) =>
    onChange(media.map(item => item.media_id === id ? { ...item, ...change } : item));
  return <section className="admin-card variant-media-card">
    <div className="admin-card-header"><h2 className="admin-card-title">平台稿素材</h2><span className="variant-counter">{media.length} / 20</span></div>
    <p className="admin-label-desc">调整这份稿件的素材顺序与封面。比例和处理说明用于人工准备。</p>
    {!!ratios.length && <p className="admin-label-desc">参考比例 {ratios.join('、')}</p>}
    {!!media.length && <ol className="variant-media-order">
      {media.map((item, index) => {
        const asset = items.find(row => row.id === item.media_id);
        const name = asset?.name ?? '素材不可用';
        const coverAllowed = kinds.get(item.media_id) === 'image' || item.is_cover;
        return <li key={item.media_id}>
          <div className="variant-media-row">
            <strong>{index + 1}. {name}</strong>
            <div className="variant-inline">
              <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" aria-label={`上移素材 ${index + 1}`} disabled={index === 0}
                onClick={() => onChange(moveVariantMedia(media, index, -1))}><ArrowUp size={14} /></button>
              <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" aria-label={`下移素材 ${index + 1}`} disabled={index === media.length - 1}
                onClick={() => onChange(moveVariantMedia(media, index, 1))}><ArrowDown size={14} /></button>
            </div>
          </div>
          <div className="variant-media-fields">
            <label className="distribution-checkbox">
              <input type="checkbox" checked={item.is_cover} disabled={!coverAllowed} aria-label={`设为封面：${name}`}
                onChange={event => onChange(media.map(row => ({ ...row, is_cover: row.media_id === item.media_id && event.target.checked })))} />
              设为封面
            </label>
            <label><span className="admin-label">建议比例</span>
              <select className="admin-select" aria-label={`素材 ${index + 1} 建议比例`} value={item.aspect_ratio_hint}
                onChange={event => update(item.media_id, { aspect_ratio_hint: event.target.value as DistributionVariantMedia['aspect_ratio_hint'] })}>
                {distributionAspectRatios.map(ratio => <option value={ratio} key={ratio}>{ratio || '保留原比例'}</option>)}
              </select>
            </label>
            <label><span className="admin-label">处理说明</span>
              <input className="admin-input" aria-label={`素材 ${index + 1} 处理说明`} maxLength={1000} value={item.processing_notes}
                onChange={event => update(item.media_id, { processing_notes: event.target.value })} placeholder="例如保留画面中心文字" />
            </label>
          </div>
          {(item.aspect_ratio_hint || item.processing_notes) && <p className="admin-label-desc">仍需处理 · 当前引用原始文件</p>}
        </li>;
      })}
    </ol>}
    <details className="variant-details">
      <summary>从媒体库增删素材</summary>
      <DistributionMediaPicker items={items} selected={media.map(item => item.media_id)} onChange={ids => onChange(replaceVariantSelection(media, ids))} />
    </details>
  </section>;
}

const severityLabels = { error: '待发布前需处理', warning: '提示', info: '参考' } as const;
const evidenceLabels = { confirmed: '已确认规则', recommendation: '准备建议', unconfirmed: '待平台确认', workspace: '工作区检查' } as const;

export function VariantRules({ profile, issues }: { profile: DistributionPlatformProfile; issues: readonly DistributionRuleIssue[] }) {
  return <section className="admin-card variant-rules" aria-labelledby="variant-rules-title">
    <div className="admin-card-header"><h2 className="admin-card-title" id="variant-rules-title">平台检查</h2><span className="distribution-platform">{profile.name}</span></div>
    <p className="admin-label-desc">本地预检查用于整理素材与文案，最终要求以实际投稿页为准。</p>
    {!issues.some(issue => issue.severity === 'error') && <p className="variant-context">工作区必填项已满足。</p>}
    <ul className="variant-issue-list">
      {issues.map(issue => <li data-severity={issue.severity} key={issue.code}><small>{severityLabels[issue.severity]} · {evidenceLabels[issue.confidence]}</small><p>{issue.message}</p></li>)}
    </ul>
    <details className="variant-details">
      <summary>平台能力与规则来源</summary>
      <dl className="variant-rule-spec">
        <div><dt>参考内容形态</dt><dd>{profile.supportedTypes.map(type => contentTypeLabels[type]).join('、')}</dd></div>
        <div><dt>标题与正文</dt><dd>{profile.titleGuidance} {profile.bodyGuidance}</dd></div>
        <div><dt>标签</dt><dd>{profile.tagGuidance}</dd></div>
        <div><dt>媒体与数量</dt><dd>{profile.mediaKinds.map(kind => kind === 'image' ? '图片' : kind === 'video' ? '视频' : '待确认').join('、')}。{profile.mediaCountGuidance}</dd></div>
        <div><dt>封面与比例</dt><dd>{profile.coverFor?.length ? `${profile.coverFor.map(type => contentTypeLabels[type]).join('、')}建议配封面。` : '请按投稿入口核对封面。'}{profile.ratios.length ? `参考比例 ${profile.ratios.join('、')}。` : ''}</dd></div>
      </dl>
      {profile.sources.length ? <ul className="variant-source-list">{profile.sources.map(source => <li key={source.url}>
        <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a><small>{source.scope}</small>
      </li>)}</ul> : <p className="admin-label-desc">通用能力没有外部平台规则来源。</p>}
      <small className="admin-label-desc">核对日期 {profile.checkedAt}</small>
    </details>
  </section>;
}

const copyButtons: { part: VariantCopyPart; label: string }[] = [
  { part: 'title', label: '复制标题' }, { part: 'body', label: '复制正文' },
  { part: 'tags', label: '复制标签' }, { part: 'all', label: '复制完整文案' },
];

export function VariantPreview({ saved, draft, profile, accountName, items, disabled, onCopy, onExport }: {
  saved: DistributionVariantRecord; draft: DistributionVariantInput; profile: DistributionPlatformProfile; accountName: string;
  items: MediaItem[]; disabled: boolean; onCopy: (part: VariantCopyPart) => void; onExport: () => void;
}) {
  return <section className="admin-card variant-preview" aria-labelledby="variant-preview-title">
    <div className="admin-card-header"><h2 className="admin-card-title" id="variant-preview-title">平台预览</h2><span className="variant-badge">本地预览</span></div>
    <article className={`variant-preview-surface variant-preview-${profile.presentation}`}>
      <div className="variant-meta"><span>{profile.name}</span><span>{accountName}</span><span>{contentTypeLabels[draft.content_type]}</span></div>
      <h3>{draft.title || '标题预览'}</h3>
      <p className="variant-preview-body">{draft.body || '尚未填写正文。'}</p>
      {!!draft.tags.length && <div className="distribution-tags">{draft.tags.map(tag => <span className="admin-tag-pill" key={tag}>#{tag}</span>)}</div>}
      {!!draft.media.length && <ol className="variant-preview-media" aria-label="预览素材顺序">
        {draft.media.map((media, index) => {
          const asset = items.find(item => item.id === media.media_id);
          const url = asset?.mime_type?.startsWith('video/') ? undefined : safeImageUrl(asset?.url);
          return <li key={media.media_id}>
            {url && <img src={url} alt="" loading="lazy" />}
            <span>{index + 1}. {asset?.name ?? '素材不可用'}{media.is_cover && ' · 封面'}</span>
          </li>;
        })}
      </ol>}
    </article>
    <p className="admin-label-desc">复制和导出使用已保存的稿件 v{saved.version}。</p>
    <div className="variant-export-actions">
      {copyButtons.map(({ part, label }) => <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" key={part}
        disabled={disabled} onClick={() => onCopy(part)}><Copy size={13} />{label}</button>)}
      <button type="button" className="admin-btn admin-btn-primary admin-btn-sm" disabled={disabled} onClick={onExport}><Download size={14} />导出平台稿 JSON</button>
    </div>
  </section>;
}

export function VariantSyncReview({ changes, sourceVersion, savedVersion, items, disabled, dirty, onSync }: {
  changes: ReturnType<typeof compareVariantSource>; sourceVersion: number; savedVersion: number; items: MediaItem[];
  disabled: boolean; dirty: boolean; onSync: (fields: DistributionVariantField[]) => Promise<boolean>;
}) {
  const [selection, setSelection] = useState<DistributionVariantField[]>([]);
  const format = (field: DistributionVariantField, value: string | string[]) => {
    if (field === 'media_ids' && Array.isArray(value)) return value.map((id, index) => `${index + 1}. ${items.find(item => item.id === id)?.name ?? '历史素材'}`).join('\n') || '无素材';
    if (field === 'content_type') return contentTypeLabels[value as keyof typeof contentTypeLabels];
    if (Array.isArray(value)) return value.join(' · ') || '无标签';
    return value || '空';
  };
  if (!changes.stale) return <p className="variant-source-version">基于内容源 v{savedVersion}。</p>;
  const sync = async () => { if (await onSync(selection)) setSelection([]); };
  return <section className="admin-card variant-sync-card">
    <div className="admin-card-header"><h2 className="admin-card-title">源内容已更新</h2><span className="variant-badge">v{savedVersion} → v{sourceVersion}</span></div>
    {changes.fields.length ? <details className="variant-details">
      <summary>查看变化并选择同步</summary>
      <p className="admin-label-desc">只同步选中的字段。其余平台稿内容保留。同步素材时保留仍引用的封面和说明，同步后的状态为草稿。</p>
      {dirty && <p className="admin-label-desc">请先保存或放弃当前编辑，再同步源内容。</p>}
      <fieldset className="admin-editor-fields" disabled={disabled || dirty}>
        {changes.fields.map(({ field, before, current, variant, customized }) => <div className="variant-diff" key={field}>
          <label className="distribution-checkbox">
            <input type="checkbox" aria-label={`同步${variantFieldLabels[field]}`} checked={selection.includes(field)}
              onChange={event => setSelection(previous => event.target.checked ? [...previous, field] : previous.filter(item => item !== field))} />
            <strong>{variantFieldLabels[field]}</strong>{customized && <span className="variant-badge">包含人工修改</span>}
          </label>
          <div className="variant-diff-values">
            <div><small>上次同步时的源</small><p>{format(field, before)}</p></div>
            <div><small>当前源</small><p>{format(field, current)}</p></div>
            <div><small>已保存平台稿</small><p>{format(field, variant)}</p></div>
          </div>
        </div>)}
        <button type="button" className="admin-btn admin-btn-primary" disabled={!selection.length} onClick={() => void sync()}>同步选中内容</button>
      </fieldset>
    </details> : <p className="admin-label-desc">源版本发生变化，标题、正文、标签、类型和素材顺序均与上次记录一致。</p>}
  </section>;
}
