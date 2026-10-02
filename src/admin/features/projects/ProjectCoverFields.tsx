import { Upload, ExternalLink, Image as ImageIcon } from 'lucide-react';
import type { useProjectEditor } from './useProjectEditor';

export function ProjectCoverFields({ editor }: { editor: ReturnType<typeof useProjectEditor> }) {
  const { draft, setField, uploadingCover, handleCoverUpload } = editor;
  return (
        <div className="admin-grid-2">
          <div className="admin-card">
            <div className="admin-card-header">
              <h3 className="admin-card-title">相关链接 (Links)</h3>
            </div>
            <div className="admin-form-group">
              <label className="admin-label" htmlFor="github-url">GitHub 仓库链接</label>
              <input
                id="github-url"
                type="url"
                className="admin-input"
                placeholder="https://github.com/Songbreezegit/..."
                value={draft.github_url}
                onChange={(e) => setField('github_url', e.target.value)}
              />
            </div>
            <div className="admin-form-group" style={{ marginBottom: 0 }}>
              <label className="admin-label" htmlFor="live-url">在线预览 / 体验链接 (可选)</label>
              <input
                id="live-url"
                type="url"
                className="admin-input"
                placeholder="https://..."
                value={draft.live_url}
                onChange={(e) => setField('live_url', e.target.value)}
              />
            </div>
          </div>

          <div className="admin-card">
            <div className="admin-card-header">
              <h3 className="admin-card-title">封面图片 (Cover Image)</h3>
            </div>

            {draft.cover_image ? (
              <div style={{ marginBottom: '14px' }}>
                <img
                  src={draft.cover_image}
                  alt="封面预览"
                  style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--admin-border)' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                  <a
                    href={draft.cover_image}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: '12px', color: 'var(--admin-accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <span>查看原图</span>
                    <ExternalLink size={12} />
                  </a>
                  <button
                    type="button"
                    className="admin-btn admin-btn-danger admin-btn-sm"
                    onClick={() => setField('cover_image', '')}
                  >
                    移除封面
                  </button>
                </div>
              </div>
            ) : (
              <div
                style={{
                  border: '2px dashed var(--admin-border)',
                  borderRadius: '8px',
                  padding: '24px',
                  textAlign: 'center',
                  marginBottom: '14px',
                  color: 'var(--admin-text-secondary)',
                }}
              >
                <ImageIcon size={28} style={{ margin: '0 auto 8px', color: 'var(--admin-text-muted)' }} />
                <p style={{ margin: 0, fontSize: '13px' }}>尚未设置封面图片</p>
              </div>
            )}

            <div>
              <label className="admin-btn admin-btn-secondary admin-btn-sm" style={{ cursor: 'pointer' }}>
                <Upload size={14} />
                <span>{uploadingCover ? '上传中...' : '上传新封面图片'}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleCoverUpload}
                  disabled={uploadingCover}
                  style={{ display: 'none' }}
                />
              </label>
              <div className="admin-label-desc" style={{ marginTop: '6px' }}>
                支持 JPG, JPEG, PNG, WEBP 格式，最大 5MB
              </div>
            </div>
          </div>
        </div>

  );
}
