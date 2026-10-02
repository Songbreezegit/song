import type { FormEvent } from 'react';
import { Save } from 'lucide-react';
import { AboutListEditor } from '../features/site/AboutListEditor';
import { useSiteSettingsEditor } from '../features/site/useSiteSettingsEditor';
import { AdminFeedback } from '../components/AdminFeedback';
import { AdminLoading } from '../components/AdminLoading';
import { AdminQueryError } from '../components/AdminQueryError';

export function AdminSiteSettings() {
  const { draft, setField, setCurrentlyField, setContactField, setAboutField, loading, saving, loadFailed: loadError,
    loadError: error, reload, feedback, save } = useSiteSettingsEditor();
  const handleSubmit = (event: FormEvent) => { event.preventDefault(); void save(); };
  if (loading) return <AdminLoading message="正在加载站点配置..." />;
  if (error) return <AdminQueryError error={error} onRetry={reload} />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <p style={{ margin: 0, fontSize: '14px', color: 'var(--admin-text-secondary)' }}>
          管理松屿 (SONG ISLE) 的全站状态（Now、Currently）、个人档案与社交联系方式。
        </p>
        <button
          type="button"
          className="admin-btn admin-btn-primary"
          onClick={handleSubmit}
          disabled={saving || loadError}
        >
          {saving ? (
            <div className="admin-spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />
          ) : (
            <Save size={15} />
          )}
          <span>保存设置</span>
        </button>
      </div>

      <AdminFeedback feedback={feedback} />

      <form onSubmit={handleSubmit}>
        <fieldset className="admin-editor-fields" disabled={saving}>
          {/* Basic Profile */}
          <div className="admin-card">
            <div className="admin-card-header">
              <h3 className="admin-card-title">站点简介与位置</h3>
            </div>

            <div className="admin-form-group">
              <label className="admin-label" htmlFor="site-intro">首页一句话引言 (Site Intro)</label>
              <textarea
                id="site-intro"
                className="admin-textarea"
                value={draft.site_intro || ''}
                onChange={(e) => setField('site_intro', e.target.value)}
                rows={2}
              />
            </div>

            <div className="admin-form-group" style={{ marginBottom: 0 }}>
              <label className="admin-label" htmlFor="based-in">常驻地理位置 (Based In)</label>
              <input
                id="based-in"
                type="text"
                className="admin-input"
                value={draft.based_in || ''}
                onChange={(e) => setField('based_in', e.target.value)}
              />
            </div>
          </div>

          {/* Currently / Now */}
          <div className="admin-card">
            <div className="admin-card-header">
              <h3 className="admin-card-title">近况状态 (Currently & Building)</h3>
            </div>

            <div className="admin-grid-2">
              <div className="admin-form-group">
                <label className="admin-label" htmlFor="curr-text">状态标语 (Current Slogan)</label>
                <input
                  id="curr-text"
                  type="text"
                  className="admin-input"
                  value={draft.currently.text || ''}
                  onChange={(e) => setCurrentlyField('text', e.target.value)}
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-label" htmlFor="curr-date">更新年月</label>
                <input
                  id="curr-date"
                  type="text"
                  className="admin-input"
                  value={draft.currently.date || ''}
                  onChange={(e) => setCurrentlyField('date', e.target.value)}
                />
              </div>
            </div>

            <div className="admin-form-group">
              <label className="admin-label" htmlFor="curr-building">正在构建 (Building)</label>
              <input
                id="curr-building"
                type="text"
                className="admin-input"
                value={draft.currently.building || ''}
                onChange={(e) => setCurrentlyField('building', e.target.value)}
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-label" htmlFor="curr-learning">正在深入 (Learning)</label>
              <input
                id="curr-learning"
                type="text"
                className="admin-input"
                value={draft.currently.learning || ''}
                onChange={(e) => setCurrentlyField('learning', e.target.value)}
              />
            </div>

            <div className="admin-form-group" style={{ marginBottom: 0 }}>
              <label className="admin-label" htmlFor="curr-exploring">正在探索 (Exploring)</label>
              <input
                id="curr-exploring"
                type="text"
                className="admin-input"
                value={draft.currently.exploring || ''}
                onChange={(e) => setCurrentlyField('exploring', e.target.value)}
              />
            </div>
          </div>

          {/* Contact & Social Links */}
          <div className="admin-card">
            <div className="admin-card-header">
              <h3 className="admin-card-title">联系方式与社交账号 (Contact & Social)</h3>
            </div>

            <div className="admin-grid-2">
              <div className="admin-form-group">
                <label className="admin-label" htmlFor="contact-email">联系邮箱</label>
                <input
                  id="contact-email"
                  type="email"
                  className="admin-input"
                  value={draft.contact.email || ''}
                  onChange={(e) => setContactField('email', e.target.value)}
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-label" htmlFor="contact-status">开放状态提示</label>
                <input
                  id="contact-status"
                  type="text"
                  className="admin-input"
                  value={draft.contact.status || ''}
                  onChange={(e) => setContactField('status', e.target.value)}
                />
              </div>
            </div>

            <div className="admin-grid-2">
              <div className="admin-form-group">
                <label className="admin-label" htmlFor="contact-github">GitHub 链接</label>
                <input
                  id="contact-github"
                  type="url"
                  className="admin-input"
                  value={draft.contact.github || ''}
                  onChange={(e) => setContactField('github', e.target.value)}
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-label" htmlFor="contact-github-user">GitHub 用户名</label>
                <input
                  id="contact-github-user"
                  type="text"
                  className="admin-input"
                  value={draft.contact.githubUser || ''}
                  onChange={(e) => setContactField('githubUser', e.target.value)}
                />
              </div>
            </div>

            <div className="admin-grid-2">
              <div className="admin-form-group">
                <label className="admin-label" htmlFor="contact-x">X (Twitter) 链接</label>
                <input
                  id="contact-x"
                  type="url"
                  className="admin-input"
                  value={draft.contact.x || ''}
                  onChange={(e) => setContactField('x', e.target.value)}
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-label" htmlFor="contact-x-user">X (Twitter) 用户名</label>
                <input
                  id="contact-x-user"
                  type="text"
                  className="admin-input"
                  value={draft.contact.xUser || ''}
                  onChange={(e) => setContactField('xUser', e.target.value)}
                />
              </div>
            </div>

            <div className="admin-grid-2">
              <div className="admin-form-group" style={{ marginBottom: 0 }}>
                <label className="admin-label" htmlFor="contact-bilibili">Bilibili 主页链接</label>
                <input
                  id="contact-bilibili"
                  type="url"
                  className="admin-input"
                  value={draft.contact.bilibili || ''}
                  onChange={(e) => setContactField('bilibili', e.target.value)}
                />
              </div>

              <div className="admin-form-group" style={{ marginBottom: 0 }}>
                <label className="admin-label" htmlFor="contact-bilibili-user">Bilibili 用户名</label>
                <input
                  id="contact-bilibili-user"
                  type="text"
                  className="admin-input"
                  value={draft.contact.bilibiliUser || ''}
                  onChange={(e) => setContactField('bilibiliUser', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="admin-card">
            <h3 className="admin-card-title">About</h3>
            {(['greeting', 'role', 'bio', 'location'] as const).map(field => (
              <div className="admin-form-group" key={field}>
                <label className="admin-label" htmlFor={'about-' + field}>{field}</label>
                <textarea id={'about-' + field} className="admin-textarea" value={draft.about?.[field] || ''}
                  onChange={e => setAboutField(field, e.target.value)} />
              </div>
            ))}
            {(['whatIDo', 'techStack', 'now', 'path'] as const).map(field => (
              <AboutListEditor key={field} field={field} about={draft.about} onChange={about => setField('about', about)} />
            ))}
          </div>
          {/* Submit Bar */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              type="submit"
              className="admin-btn admin-btn-primary"
              disabled={saving || loadError}
            >
              {saving ? (
                <div className="admin-spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />
              ) : (
                <Save size={15} />
              )}
              <span>保存全站设置</span>
            </button>
          </div>
        </fieldset>
      </form>
    </div>
  );
}
