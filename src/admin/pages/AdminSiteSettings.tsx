import type { FormEvent } from 'react';
import { Save } from 'lucide-react';
import { AboutListEditor } from '../features/site/AboutListEditor';
import { useSiteSettingsEditor } from '../features/site/useSiteSettingsEditor';
import { AdminFeedback } from '../components/AdminFeedback';
import { AdminLoading } from '../components/AdminLoading';
import { AdminQueryError } from '../components/AdminQueryError';
import { AdminEditorHeader, AdminEditorNavigation } from '../components/AdminEditorChrome';

const sections = [{ id: 'site-profile', label: '首页简介' }, { id: 'site-currently', label: '近况状态' }, { id: 'site-contact', label: '联系方式' }, { id: 'site-about', label: '关于我' }];
const aboutLabels = { greeting: '开场问候', role: '身份与角色', bio: '个人介绍', location: '个人档案所在地' };

export function AdminSiteSettings() {
  const { draft, setField, setCurrentlyField, setContactField, setAboutField, loading, saving, loadFailed: loadError,
    loadError: error, reload, feedback, save, isDirty, lastSavedAt } = useSiteSettingsEditor();
  const handleSubmit = (event: FormEvent) => { event.preventDefault(); void save(); };
  if (loading) return <AdminLoading message="正在加载站点配置..." />;
  if (error) return <AdminQueryError error={error} onRetry={reload} />;

  return (
    <div className="admin-editor-workspace">
      <AdminEditorHeader title="站点设置" description="维护首页近况、个人档案和联系方式，让网站内容保持新鲜。" isDirty={isDirty} saving={saving} lastSavedAt={lastSavedAt} actions={
        <button
          type="submit"
          form="site-editor-form"
          className="admin-btn admin-btn-primary"
          disabled={saving || loadError}
        >
          {saving ? (
            <div className="admin-spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />
          ) : (
            <Save size={15} />
          )}
          <span>保存设置</span>
        </button>
      } />

      <AdminFeedback feedback={feedback} />

      <AdminEditorNavigation sections={sections} />
      <form id="site-editor-form" onSubmit={handleSubmit}>
        <fieldset className="admin-editor-fields" disabled={saving}>
          <div className="admin-editor-layout"><div className="admin-editor-main">
          {/* Basic Profile */}
          <div className="admin-card admin-editor-section" id="site-profile">
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
          <div className="admin-card admin-editor-section" id="site-currently">
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
          <div className="admin-card admin-editor-section" id="site-contact">
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

          <div className="admin-card admin-editor-section" id="site-about">
            <div className="admin-card-header"><h3 className="admin-card-title">关于我</h3><span className="admin-label-desc">个人档案与经历</span></div>
            {(['greeting', 'role', 'bio', 'location'] as const).map(field => (
              <div className="admin-form-group" key={field}>
                <label className="admin-label" htmlFor={'about-' + field}>{aboutLabels[field]}</label>
                <textarea id={'about-' + field} className="admin-textarea" value={draft.about?.[field] || ''}
                  onChange={e => setAboutField(field, e.target.value)} />
              </div>
            ))}
            {(['whatIDo', 'techStack', 'now', 'path'] as const).map(field => (
              <AboutListEditor key={field} field={field} about={draft.about} onChange={about => setField('about', about)} />
            ))}
          </div>
          </div><aside className="admin-editor-aside" aria-label="站点设置保存">
          <section className="admin-card admin-editor-publish-panel">
            <div className="admin-card-header"><h3 className="admin-card-title">保存与生效</h3></div>
            <p className="admin-editor-note">这些设置共同组成公开网站。保存后，首页简介、近况、联系方式与关于我内容一起更新。</p>
            <ul className="admin-editor-checklist"><li>首页简介 → 首页第一屏</li><li>近况状态 → Currently 区域</li><li>联系方式 → 联系区域</li><li>关于我 → 个人档案</li></ul>
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
          </section></aside></div>
        </fieldset>
      </form>
    </div>
  );
}
