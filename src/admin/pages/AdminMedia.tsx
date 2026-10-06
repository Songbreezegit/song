import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Upload, Trash2, Copy, Check, RefreshCw, ExternalLink, Image as ImageIcon, SearchX, X } from 'lucide-react';
import { listMedia, uploadMedia, deleteMedia, type MediaItem } from '../../services/mediaService';
import { useAdminQuery } from '../hooks/useAdminQuery';
import { useAdminAction } from '../hooks/useAdminAction';
import { useCollectionView } from '../hooks/useCollectionView';
import { formatCollectionDate } from '../lib/collection';
import { AdminFeedback } from '../components/AdminFeedback';
import { AdminLoading } from '../components/AdminLoading';
import { AdminQueryError } from '../components/AdminQueryError';
import { AdminPageHeader } from '../components/AdminPageHeader';
import { CollectionPagination, CollectionToolbar } from '../components/CollectionControls';

function mediaFormat(item: MediaItem): string {
  const extension = item.name.split('.').pop()?.toLowerCase() || '';
  return extension === 'jpeg' ? 'jpg' : extension;
}

export function AdminMedia() {
  const { data: items, setData: setItems, loading, error, reload: loadMedia } = useAdminQuery<MediaItem[]>(listMedia, [], '加载媒体库失败');
  const { feedback, run, pendingKey } = useAdminAction('媒体操作失败');
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploading = pendingKey === 'upload';
  const busy = Boolean(pendingKey);
  const selected = items.find(item => item.path === selectedPath);
  const view = useCollectionView(items.map(item => ({ key: item.path, title: item.name,
    searchText: `${item.name} ${item.path}`, category: mediaFormat(item), updatedAt: item.created_at, item,
  })), 12);
  const formats = [...new Set(items.map(mediaFormat))].sort().map(format => ({ value: format, label: format.toUpperCase() || '其他' }));

  useEffect(() => {
    if (!copiedUrl) return;
    const timer = setTimeout(() => setCopiedUrl(null), 2000);
    return () => clearTimeout(timer);
  }, [copiedUrl]);

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    await run('upload', () => uploadMedia(file, 'uploads'), {
      successMessage: `文件「${file.name}」上传成功！`, onSuccess: async result => {
        setSelectedPath(result.path);
        await loadMedia();
      },
    });
    input.value = '';
  };
  const handleCopyUrl = (url: string) => {
    setCopiedUrl(null);
    setSelectedPath(items.find(item => item.url === url)?.path || null);
    return run('copy', async () => {
      if (!navigator.clipboard?.writeText) throw new Error('当前浏览器无法自动复制，请在图片详情中选中链接手动复制。');
      await navigator.clipboard.writeText(url);
    }, {
      successMessage: '图片链接已复制，可粘贴到项目封面或文章插图。',
      onSuccess: () => setCopiedUrl(url),
    });
  };
  const handleDelete = (path: string, name: string) => {
    if (!window.confirm(`确定要删除媒体文件「${name}」吗？使用这张图片的内容将无法显示图片，此操作不可撤销。`)) return;
    return run(path, () => deleteMedia(path), { successMessage: '文件已成功删除',
      onSuccess: () => setItems(previous => previous.filter(item => item.path !== path)),
    });
  };

  return <div className="admin-collection-page">
    <AdminPageHeader eyebrow="内容资源" title="媒体库" description="集中管理封面和插图，选择图片即可预览并复制链接。" actions={<>
      <button onClick={loadMedia} className="admin-btn admin-btn-secondary" title="刷新" aria-label="刷新媒体库"
        disabled={loading || busy}><RefreshCw size={15} className={loading ? 'admin-spinner' : ''} />刷新</button>
      <button className="admin-btn admin-btn-primary" disabled={busy} onClick={() => fileInput.current?.click()}>
        <Upload size={16} />{uploading ? '上传中...' : '上传新图片'}
      </button>
      <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFileUpload}
        disabled={busy} className="admin-visually-hidden" aria-label="选择上传图片" />
    </>} />
    <AdminFeedback feedback={feedback} />
    <div className="admin-media-workspace">
      <section className="admin-card admin-collection-card admin-media-library" aria-label="图片列表">
        <div className="admin-media-library-heading"><h2>图片资源 <span>{loading || error ? '—' : items.length}</span></h2>
          <p>JPG、JPEG、PNG、WEBP · 每张最大 5 MB</p>
        </div>
        <CollectionToolbar label="图片" query={view.filters.query} onQuery={value => view.updateFilter('query', value)}
          category={view.filters.category} categories={formats} categoryLabel="格式" onCategory={value => view.updateFilter('category', value)}
          sort={view.filters.sort} onSort={value => view.updateFilter('sort', value)} includeOrder={false}
          hasFilters={view.hasFilters} onClear={view.clearFilters} />
        {loading ? <AdminLoading message="正在加载媒体库..." /> : error ? <AdminQueryError error={error} onRetry={loadMedia} /> :
          items.length === 0 ? <div className="admin-empty-state"><div className="admin-empty-icon"><ImageIcon size={30} /></div>
            <h3>媒体库中暂无已上传的文件。</h3><p>上传封面或插图，再将图片链接用于项目和文章。</p>
            <button className="admin-btn admin-btn-primary" disabled={busy} onClick={() => fileInput.current?.click()}><Upload size={16} />上传新图片</button>
          </div> : view.total === 0 ? <div className="admin-empty-state"><div className="admin-empty-icon"><SearchX size={28} /></div>
            <h3>没有匹配的图片</h3><p>可以搜索文件名或所在文件夹，也可以清除筛选。</p>
            <button className="admin-btn admin-btn-secondary" onClick={view.clearFilters}>清除筛选</button>
          </div> : <>
            <div className="admin-media-grid">{view.visible.map(({ item }) => <div key={item.path}
              className={`admin-media-card${selected?.path === item.path ? ' is-selected' : ''}`}>
              <button className="admin-media-select" aria-label={`选择图片：${item.name}`} aria-pressed={selected?.path === item.path}
                onClick={() => setSelectedPath(item.path)}><img src={item.url} alt={item.name} className="admin-media-thumb" loading="lazy" /></button>
              <div className="admin-media-info"><span className="admin-media-name" title={item.name}>{item.name}</span>
                <div className="admin-media-meta"><span>{mediaFormat(item).toUpperCase()}</span><span>{formatCollectionDate(item.created_at)}</span></div>
                <div className="admin-media-actions">
                  <button className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => handleCopyUrl(item.url)}
                    disabled={busy} title="复制公开访问链接" aria-label={`复制链接：${item.name}`}>
                    {copiedUrl === item.url ? <Check size={13} /> : <Copy size={13} />}{copiedUrl === item.url ? '已复制' : '复制链接'}
                  </button>
                  <a href={item.url} target="_blank" rel="noreferrer" className="admin-btn admin-btn-secondary admin-btn-sm" title="查看原图"
                    aria-label={`查看原图：${item.name}`}><ExternalLink size={13} /></a>
                  <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => handleDelete(item.path, item.name)} disabled={busy}
                    title="删除图片" aria-label={`删除图片：${item.name}`}><Trash2 size={13} /></button>
                </div>
              </div>
            </div>)}</div>
            <CollectionPagination total={view.total} page={view.page} pageCount={view.pageCount} pageSize={view.pageSize}
              onPage={value => view.updateFilter('page', value)} />
          </>}
      </section>
      <aside className="admin-card admin-media-detail" aria-label="图片详情">
        <div className="admin-media-detail-heading"><h2>图片详情</h2>{selected && <button className="admin-btn admin-btn-secondary admin-btn-sm"
          aria-label="关闭图片详情" onClick={() => setSelectedPath(null)}><X size={15} /></button>}</div>
        {selected && !loading && !error ? <>
          <img className="admin-media-detail-preview" src={selected.url} alt={selected.name} />
          <h3>{selected.name}</h3>
          <dl className="admin-media-properties"><div><dt>格式</dt><dd>{mediaFormat(selected).toUpperCase()}</dd></div>
            <div><dt>上传日期</dt><dd>{formatCollectionDate(selected.created_at)}</dd></div>
            <div><dt>存储路径</dt><dd>{selected.path}</dd></div></dl>
          <label className="admin-label" htmlFor="selected-media-url">图片链接</label>
          <input id="selected-media-url" className="admin-input" readOnly value={selected.url} onFocus={event => event.currentTarget.select()} />
          <p className="admin-media-detail-hint">点击复制链接，用于封面或插图。也可以选中上方链接手动复制。</p>
          <button className="admin-btn admin-btn-primary admin-media-copy-button" disabled={busy} title="复制公开访问链接"
            onClick={() => handleCopyUrl(selected.url)}>{copiedUrl === selected.url ? <Check size={15} /> : <Copy size={15} />}
            {copiedUrl === selected.url ? '已复制图片链接' : '复制图片链接'}</button>
          <a href={selected.url} target="_blank" rel="noreferrer" className="admin-btn admin-btn-secondary admin-media-copy-button"><ExternalLink size={15} />查看原图</a>
        </> : <div className="admin-media-detail-empty"><ImageIcon size={32} /><h3>选择一张图片</h3><p>点击图片查看预览、存储路径和可以复制的图片链接。</p></div>}
      </aside>
    </div>
  </div>;
}
