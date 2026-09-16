import { useEffect, useState, type FormEvent } from 'react';
import { Save, CheckCircle, AlertCircle } from 'lucide-react';
import { fetchSiteSettings, updateSiteSettings } from '../../services/siteService';
import type { SiteSettingsRecord } from '../../types/database';

export function AdminSiteSettings() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [siteIntro, setSiteIntro] = useState('');
  const [basedIn, setBasedIn] = useState('');

  const [currentlyText, setCurrentlyText] = useState('');
  const [currentlyBuilding, setCurrentlyBuilding] = useState('');
  const [currentlyLearning, setCurrentlyLearning] = useState('');
  const [currentlyExploring, setCurrentlyExploring] = useState('');
  const [currentlyDate, setCurrentlyDate] = useState('');

  const [contactEmail, setContactEmail] = useState('');
  const [contactGithub, setContactGithub] = useState('');
  const [contactGithubUser, setContactGithubUser] = useState('');
  const [contactX, setContactX] = useState('');
  const [contactXUser, setContactXUser] = useState('');
  const [contactBilibili, setContactBilibili] = useState('');
  const [contactBilibiliUser, setContactBilibiliUser] = useState('');
  const [contactStatus, setContactStatus] = useState('');

  const [aboutData, setAboutData] = useState<SiteSettingsRecord['about'] | null>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        setLoading(true);
        const data = await fetchSiteSettings();
        if (!data) {
          setFeedback({ type: 'success', message: '尚无站点设置，请填写后保存。' });
          return;
        }
        setSiteIntro(data.site_intro || '');
        setBasedIn(data.based_in || '');

        setCurrentlyText(data.currently?.text || '');
        setCurrentlyBuilding(data.currently?.building || '');
        setCurrentlyLearning(data.currently?.learning || '');
        setCurrentlyExploring(data.currently?.exploring || '');
        setCurrentlyDate(data.currently?.date || '');

        setContactEmail(data.contact?.email || '');
        setContactGithub(data.contact?.github || '');
        setContactGithubUser(data.contact?.githubUser || '');
        setContactX(data.contact?.x || '');
        setContactXUser(data.contact?.xUser || '');
        setContactBilibili(data.contact?.bilibili || '');
        setContactBilibiliUser(data.contact?.bilibiliUser || '');
        setContactStatus(data.contact?.status || '');

        setAboutData(data.about || null);
      } catch (err) {
        setLoadError(true);
        setFeedback({
          type: 'error',
          message: err instanceof Error ? err.message : '加载站点设置失败',
        });
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loadError) return;
    try {
      setSaving(true);
      setFeedback(null);

      await updateSiteSettings({
        site_intro: siteIntro.trim(),
        based_in: basedIn.trim(),
        currently: {
          text: currentlyText.trim(),
          building: currentlyBuilding.trim(),
          learning: currentlyLearning.trim(),
          exploring: currentlyExploring.trim(),
          date: currentlyDate.trim(),
        },
        contact: {
          email: contactEmail.trim(),
          github: contactGithub.trim(),
          githubUser: contactGithubUser.trim(),
          x: contactX.trim(),
          xUser: contactXUser.trim(),
          bilibili: contactBilibili.trim(),
          bilibiliUser: contactBilibiliUser.trim(),
          status: contactStatus.trim(),
        },
        about: aboutData || ({} as SiteSettingsRecord['about']),
      });

      setFeedback({ type: 'success', message: '站点设置已成功保存！' });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : '保存设置失败',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--admin-text-secondary)' }}>
        <div className="admin-spinner" style={{ margin: '0 auto 16px' }} />
        正在加载站点配置...
      </div>
    );
  }

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

      <form onSubmit={handleSubmit}>
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
              value={siteIntro}
              onChange={(e) => setSiteIntro(e.target.value)}
              rows={2}
            />
          </div>

          <div className="admin-form-group" style={{ marginBottom: 0 }}>
            <label className="admin-label" htmlFor="based-in">常驻地理位置 (Based In)</label>
            <input
              id="based-in"
              type="text"
              className="admin-input"
              value={basedIn}
              onChange={(e) => setBasedIn(e.target.value)}
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
                value={currentlyText}
                onChange={(e) => setCurrentlyText(e.target.value)}
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-label" htmlFor="curr-date">更新年月</label>
              <input
                id="curr-date"
                type="text"
                className="admin-input"
                value={currentlyDate}
                onChange={(e) => setCurrentlyDate(e.target.value)}
              />
            </div>
          </div>

          <div className="admin-form-group">
            <label className="admin-label" htmlFor="curr-building">正在构建 (Building)</label>
            <input
              id="curr-building"
              type="text"
              className="admin-input"
              value={currentlyBuilding}
              onChange={(e) => setCurrentlyBuilding(e.target.value)}
            />
          </div>

          <div className="admin-form-group">
            <label className="admin-label" htmlFor="curr-learning">正在深入 (Learning)</label>
            <input
              id="curr-learning"
              type="text"
              className="admin-input"
              value={currentlyLearning}
              onChange={(e) => setCurrentlyLearning(e.target.value)}
            />
          </div>

          <div className="admin-form-group" style={{ marginBottom: 0 }}>
            <label className="admin-label" htmlFor="curr-exploring">正在探索 (Exploring)</label>
            <input
              id="curr-exploring"
              type="text"
              className="admin-input"
              value={currentlyExploring}
              onChange={(e) => setCurrentlyExploring(e.target.value)}
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
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-label" htmlFor="contact-status">开放状态提示</label>
              <input
                id="contact-status"
                type="text"
                className="admin-input"
                value={contactStatus}
                onChange={(e) => setContactStatus(e.target.value)}
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
                value={contactGithub}
                onChange={(e) => setContactGithub(e.target.value)}
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-label" htmlFor="contact-github-user">GitHub 用户名</label>
              <input
                id="contact-github-user"
                type="text"
                className="admin-input"
                value={contactGithubUser}
                onChange={(e) => setContactGithubUser(e.target.value)}
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
                value={contactX}
                onChange={(e) => setContactX(e.target.value)}
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-label" htmlFor="contact-x-user">X (Twitter) 用户名</label>
              <input
                id="contact-x-user"
                type="text"
                className="admin-input"
                value={contactXUser}
                onChange={(e) => setContactXUser(e.target.value)}
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
                value={contactBilibili}
                onChange={(e) => setContactBilibili(e.target.value)}
              />
            </div>

            <div className="admin-form-group" style={{ marginBottom: 0 }}>
              <label className="admin-label" htmlFor="contact-bilibili-user">Bilibili 用户名</label>
              <input
                id="contact-bilibili-user"
                type="text"
                className="admin-input"
                value={contactBilibiliUser}
                onChange={(e) => setContactBilibiliUser(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="admin-card">
          <h3 className="admin-card-title">About</h3>
          {(['greeting', 'role', 'bio', 'location'] as const).map(field => (
            <div className="admin-form-group" key={field}>
              <label className="admin-label" htmlFor={'about-' + field}>{field}</label>
              <textarea id={'about-' + field} className="admin-textarea" value={aboutData?.[field] || ''}
                onChange={e => setAboutData(prev => ({ greeting: '', role: '', bio: '', location: '', whatIDo: [], techStack: [], now: [], path: [], ...prev, [field]: e.target.value }))} />
            </div>
          ))}
          {(['whatIDo', 'techStack', 'now', 'path'] as const).map(field => (
            <AboutListEditor key={field} field={field} about={aboutData} onChange={setAboutData} />
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
      </form>
    </div>
  );
}

function AboutListEditor({ field, about, onChange }: {
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
