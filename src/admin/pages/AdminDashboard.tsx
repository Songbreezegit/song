import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock, FileEdit, FileText, FolderGit2, Plus, RefreshCw, ChartNoAxesCombined } from 'lucide-react';
import { fetchAdminDashboard, type AdminDashboardData } from '../../services/adminService';
import { fetchAdminAnalytics, type AdminAnalyticsData } from '../../services/analyticsService';
import { useAdminQuery } from '../hooks/useAdminQuery';
import { AdminQueryError } from '../components/AdminQueryError';
import { AdminPageHeader } from '../components/AdminPageHeader';
import { ContentStatusBadge } from '../components/ContentStatusBadge';
import { AnalyticsMetrics, AnalyticsTrend, AnalyticsDistribution, AnalyticsContentTable } from '../components/AdminAnalytics';

const emptyDashboard: AdminDashboardData = { projects: { total: 0, published: 0, draft: 0 }, articles: { total: 0, published: 0, draft: 0 }, recentItems: [] };
const emptyAnalytics: AdminAnalyticsData = { enabled: false, reason: 'migration_required' };

export function AdminDashboard() {
  const [days, setDays] = useState(30);
  const content = useAdminQuery(fetchAdminDashboard, emptyDashboard, '内容概览加载失败，请重试。');
  const loadAnalytics = useCallback(() => fetchAdminAnalytics(days), [days]);
  const analytics = useAdminQuery(loadAnalytics, emptyAnalytics, '访问统计加载失败，请重试。');
  const rangePending = analytics.data.enabled && analytics.data.days !== days;
  const stats = !analytics.loading && !rangePending && !analytics.error && analytics.data.enabled ? analytics.data : null;
  const refresh = () => { void content.reload(); void analytics.reload(); };
  const contentCount = (count: number) => content.loading ? '…' : content.error ? '—' : count;

  return <div className="admin-dashboard">
    <AdminPageHeader title="网站仪表盘" description="从访问趋势到内容表现，了解松屿的每一次连接。"
      actions={<><select className="admin-select admin-analytics-range" aria-label="统计时段" value={days} onChange={event => setDays(Number(event.target.value))}><option value={7}>最近 7 天</option><option value={30}>最近 30 天</option><option value={90}>最近 90 天</option></select><button type="button" onClick={refresh} disabled={content.loading || analytics.loading} className="admin-btn admin-btn-secondary" aria-label="刷新仪表盘"><RefreshCw size={16} />刷新</button><Link to="/admin/articles/new" className="admin-btn admin-btn-primary"><Plus size={16} />新建文章</Link></>} />
    <AdminQueryError error={analytics.error} onRetry={analytics.reload} />
    <div className="admin-analytics-overview"><AnalyticsMetrics data={stats} pending={analytics.loading || (rangePending && !analytics.error)} days={days} />
      <section className="admin-card admin-analytics-inventory" aria-label="内容概况"><div className="admin-card-header"><h2 className="admin-card-title">内容概况</h2><FileEdit size={18} /></div><AdminQueryError error={content.error} onRetry={content.reload} />
        {[{ label: '作品项目', key: 'projects' as const, Icon: FolderGit2 }, { label: '思考与笔记', key: 'articles' as const, Icon: FileText }].map(({ label, key, Icon }) => <Link key={key} className="admin-analytics-inventory-row" to={`/admin/${key}`}><span><Icon size={18} />{label}<small>{content.loading || content.error ? '—' : `${content.data[key].published} 已发布 · ${content.data[key].draft} 草稿`}</small></span><strong className="admin-stat-value">{contentCount(content.data[key].total)}</strong></Link>)}
        <div className="admin-analytics-inventory-actions"><Link to="/admin/projects/new" className="admin-btn admin-btn-secondary admin-btn-sm"><Plus size={14} />新建项目</Link><Link to="/admin/articles?status=draft" className="admin-btn admin-btn-secondary admin-btn-sm">继续草稿<ArrowRight size={14} /></Link></div>
      </section>
    </div>
    {!analytics.loading && !analytics.error && !analytics.data.enabled && <section className="admin-card admin-analytics-setup" role="status"><ChartNoAxesCombined size={28} /><div><h2 className="admin-card-title">访问统计尚未启用</h2><p>启用后将开始记录网站浏览及文章、项目的详情打开次数。已有历史访问不会自动补入。</p></div></section>}
    {(analytics.loading || rangePending) && !analytics.error && <div className="admin-card admin-loading-content" role="status"><div className="admin-spinner" />正在加载访问统计...</div>}
    {stats && <><div className="admin-analytics-grid"><AnalyticsTrend daily={stats.daily} /><AnalyticsDistribution articles={stats.articleClicks} projects={stats.projectClicks} /></div><AnalyticsContentTable key={days} articles={stats.articles} projects={stats.projects} days={days} /><p className="admin-analytics-footnote">按北京时间统计。浏览量是公开页面打开次数，点击量是内容详情打开次数，包含直接链接；后台访问不计入，统计不代表独立访客人数。</p></>}
    <section className="admin-card admin-recent-card"><div className="admin-card-header"><div><h2 className="admin-card-title">最近内容变动</h2><p className="admin-card-description">接着上一次的灵感，继续编辑。</p></div><Link to="/admin/projects" className="admin-btn admin-btn-secondary admin-btn-sm">管理内容<ArrowRight size={14} /></Link></div>
      {content.loading ? <div className="admin-loading-content"><div className="admin-spinner" />正在加载内容...</div> : content.error ? null : content.data.recentItems.length === 0 ? <div className="admin-empty-state"><div className="admin-empty-icon"><FileEdit size={26} /></div><h3>从第一份内容开始</h3><p>暂无更新记录。请新建项目或文章。</p><Link to="/admin/articles/new" className="admin-btn admin-btn-secondary"><Plus size={15} />开始写文章</Link></div> : <div className="admin-recent-list">{content.data.recentItems.map(item => <Link className="admin-recent-item" key={`${item.type}-${item.id}`} to={`/admin/${item.type === 'project' ? 'projects' : 'articles'}/${item.id}`}><span className={`admin-content-icon ${item.type === 'article' ? 'is-article' : ''}`}>{item.type === 'project' ? <FolderGit2 size={20} /> : <FileText size={20} />}</span><span className="admin-recent-copy"><strong>{item.title || '未命名内容'}</strong><span>{item.type === 'project' ? '项目' : '文章'}<span aria-hidden="true"> · </span><Clock size={12} />{new Date(item.updated_at).toLocaleDateString('zh-CN')}</span></span><ContentStatusBadge status={item.status} /><ArrowRight size={16} /></Link>)}</div>}
    </section>
  </div>;
}
