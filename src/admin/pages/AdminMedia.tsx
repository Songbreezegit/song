import { useEffect, useState, type ChangeEvent } from 'react';
import { Upload, Trash2, Copy, Check, RefreshCw, ExternalLink, Image as ImageIcon } from 'lucide-react';
import { listMedia, uploadMedia, deleteMedia, type MediaItem } from '../../services/mediaService';
import { useAdminQuery } from '../hooks/useAdminQuery';
import { useAdminAction } from '../hooks/useAdminAction';
import { AdminFeedback } from '../components/AdminFeedback';
import { AdminLoading } from '../components/AdminLoading';
import { AdminQueryError } from '../components/AdminQueryError';

export function AdminMedia() {
  const { data: items, setData: setItems, loading, error, reload: loadMedia } = useAdminQuery<MediaItem[]>(listMedia, [], '加载媒体库失败');
  const { feedback, run, pendingKey } = useAdminAction('媒体操作失败');
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const uploading = pendingKey === 'upload';

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
      successMessage: `文件「${file.name}」上传成功！`, onSuccess: () => loadMedia(),
    });
    input.value = '';
  };
  const handleCopyUrl = (url: string) => run('copy', () => navigator.clipboard.writeText(url), { onSuccess: () => setCopiedUrl(url) });
  const handleDelete = (path: string, name: string) => {
    if (!window.confirm(`确定要删除媒体文件「${name}」吗？`)) return;
    return run(path, () => deleteMedia(path), { successMessage: '文件已成功删除',
      onSuccess: () => setItems(previous => previous.filter(item => item.path !== path)),
    });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <p style={{ margin: 0, fontSize: '14px', color: 'var(--admin-text-secondary)' }}>
          管理 Supabase Storage <code>media</code> 存储桶中的封面图片与上传媒体资源。
          仅支持 JPG、JPEG、PNG、WEBP，最大 5MB。
        </p>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={loadMedia}
            className="admin-btn admin-btn-secondary"
            title="刷新"
            disabled={loading || Boolean(pendingKey)}
          >
            <RefreshCw size={15} className={loading ? 'admin-spinner' : ''} />
          </button>
          <label className="admin-btn admin-btn-primary" style={{ cursor: 'pointer' }}>
            <Upload size={15} />
            <span>{uploading ? '上传中...' : '上传新图片'}</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileUpload}
              disabled={Boolean(pendingKey)}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      </div>

      <AdminFeedback feedback={feedback} />

      {loading ? (
        <AdminLoading message="正在加载媒体库..." />
      ) : error ? (
        <AdminQueryError error={error} onRetry={loadMedia} />
      ) : items.length === 0 ? (
        <div className="admin-card" style={{ padding: '48px', textAlign: 'center' }}>
          <ImageIcon size={36} style={{ color: 'var(--admin-text-muted)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--admin-text-secondary)', margin: 0, fontSize: '14px' }}>
            媒体库中暂无已上传的文件。
          </p>
          <p style={{ color: 'var(--admin-text-muted)', fontSize: '12px', marginTop: '6px' }}>
            上传后的图片可一键复制公开 URL 填入项目封面或文章插图。
          </p>
        </div>
      ) : (
        <div className="admin-media-grid">
          {items.map((item) => (
            <div key={item.path} className="admin-media-card">
              <img src={item.url} alt={item.name} className="admin-media-thumb" loading="lazy" />
              <div className="admin-media-info">
                <span className="admin-media-name" title={item.name}>
                  {item.name}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--admin-text-muted)' }}>
                  {new Date(item.created_at).toLocaleDateString('zh-CN')}
                </span>

                <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                  <button
                    className="admin-btn admin-btn-secondary admin-btn-sm"
                    style={{ flex: 1, padding: '4px 6px', fontSize: '11px' }}
                    onClick={() => handleCopyUrl(item.url)}
                    title="复制公开访问链接"
                  >
                    {copiedUrl === item.url ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copiedUrl === item.url ? '已复制' : '复制链接'}</span>
                  </button>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="admin-btn admin-btn-secondary admin-btn-sm"
                    style={{ padding: '4px 6px' }}
                    title="查看原图"
                  >
                    <ExternalLink size={12} />
                  </a>
                  <button
                    className="admin-btn admin-btn-danger admin-btn-sm"
                    style={{ padding: '4px 6px' }}
                    onClick={() => handleDelete(item.path, item.name)}
                    disabled={Boolean(pendingKey)}
                    title="删除图片"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
