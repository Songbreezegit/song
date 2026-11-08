import { useState } from 'react';
import { X } from 'lucide-react';
import type { MediaItem } from '../../../services/mediaService';
import { safeImageUrl } from '../../../lib/safeUrl';
import { CollectionPagination } from '../../components/CollectionControls';

export function DistributionMediaPicker({ items, selected, onChange }: { items: MediaItem[]; selected: string[]; onChange: (ids: string[]) => void }) {
  const [search, setSearch] = useState('');
  const [requestedPage, setPage] = useState(1);
  const filtered = items.filter(item => `${item.name} ${item.path}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const pageCount = Math.max(1, Math.ceil(filtered.length / 8));
  const page = Math.min(requestedPage, pageCount);
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter(value => value !== id) : [...selected, id]);
  return <div className="distribution-media-picker">
    <label className="admin-label" htmlFor="distribution-media-search">搜索已有媒体</label><input id="distribution-media-search" className="admin-input" type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="文件名或路径" />
    <p className="admin-label-desc" aria-live="polite">已选择 {selected.length} / 20 张。素材来自现有媒体库。</p>
    {selected.length > 0 && <div className="distribution-tags">{selected.map((id, index) => <span className="admin-tag-pill" key={id}>{index + 1}. {items.find(item => item.id === id)?.name || '素材不可用'}<button type="button" className="admin-tag-remove" aria-label={`移除素材 ${index + 1}`} onClick={() => toggle(id)}><X size={12} /></button></span>)}</div>}
    {!items.length ? <p className="admin-editor-note">媒体库暂无图片，可先在媒体库上传，再回来选择。视频类型目前可先整理文案和已有封面。</p> : !filtered.length ? <p className="admin-editor-note">没有匹配的素材，试试其他关键词。</p> : <>
      <div className="distribution-media-grid">{filtered.slice((page - 1) * 8, page * 8).map(item => <label className={`distribution-media-option${selected.includes(item.id) ? ' is-selected' : ''}`} key={item.id}>
        {safeImageUrl(item.url) && <img src={safeImageUrl(item.url)} alt="" loading="lazy" />}<span><input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)} disabled={!selected.includes(item.id) && selected.length >= 20} /><span>{item.name}</span></span></label>)}</div>
      <CollectionPagination total={filtered.length} page={page} pageCount={pageCount} pageSize={8} onPage={setPage} />
    </>}
  </div>;
}
