import { useEffect, useState, type ChangeEvent } from 'react';
import {
  Upload,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  ExternalLink,
  Image as ImageIcon,
} from 'lucide-react';
import { listMedia, uploadMedia, deleteMedia, type MediaItem } from '../../services/mediaService';
import { isSupabaseConfigured } from '../../lib/supabase';

export function AdminMedia() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(Boolean(isSupabaseConfigured));
  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);

  const loadMedia = async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await listMedia();
      setItems(data);
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : '加载媒体库失败',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    if (!isSupabaseConfigured) return;
    listMedia()
      .then((data) => {
        if (active) {
          setItems(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setFeedback({
            type: 'error',
            message: err instanceof Error ? err.message : '加载媒体库失败',
          });
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setFeedback(null);
      await uploadMedia(file, 'uploads');
      setFeedback({ type: 'success', message: `文件「${file.name}」上传成功！` });
      await loadMedia();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : '上传文件失败',
      });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleCopyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch {
      setFeedback({ type: 'error', message: '复制链接失败，请手动选择复制' });
    }
  };

  const handleDelete = async (path: string, name: string) => {
    if (!window.confirm(`确定要删除媒体文件「${name}」吗？`)) {
      return;
    }

    try {
      setDeletingPath(path);
      setFeedback(null);
      await deleteMedia(path);
      setFeedback({ type: 'success', message: '文件已成功删除' });
      setItems((prev) => prev.filter((item) => item.path !== path));
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : '删除文件失败',
      });
    } finally {
      setDeletingPath(null);
    }
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
            disabled={loading}
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
              disabled={uploading}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      </div>

      {feedback && (
        <div
          className={`admin-alert ${
            feedback.type === 'success' ? 'admin-alert-success' : 'admin-alert-error'
          }`}
        >
          {feedback.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <div>{feedback.message}</div>
        </div>
      )}

      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--admin-text-secondary)' }}>
          <div className="admin-spinner" style={{ margin: '0 auto 16px' }} />
          正在加载媒体库...
        </div>
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
                    disabled={deletingPath === item.path}
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
