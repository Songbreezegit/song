import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Eye, FileText, FolderGit2, Search } from 'lucide-react';
import type { AdminAnalyticsData, AnalyticsContentItem, AnalyticsDailyPoint } from '../../services/analyticsService';
import { ContentStatusBadge } from './ContentStatusBadge';

const formatMetric = (value: number) => value.toLocaleString('zh-CN');
type EnabledAnalytics = Extract<AdminAnalyticsData, { enabled: true }>;

export function AnalyticsMetrics({ data, pending, days }: { data: EnabledAnalytics | null; pending: boolean; days: number }) {
  const value = (count: number | undefined) => pending ? '…' : count === undefined ? '—' : formatMetric(count);
  return <div className="admin-analytics-metrics">
    <section className="admin-analytics-hero" aria-label="网站访问量">
      <div className="admin-analytics-hero-inset"><span className="admin-analytics-label"><Eye size={17} />网站访问量 <span>PV</span></span><strong className="admin-analytics-value" data-testid="period-views">{value(data?.periodViews)}</strong><span className="admin-analytics-period">最近 {days} 天的公开页面浏览</span></div>
      <div className="admin-analytics-hero-footer"><div><span>今日浏览</span><strong data-testid="today-views">{value(data?.todayViews)}</strong></div><div><span>累计浏览</span><strong data-testid="total-views">{value(data?.totalViews)}</strong></div></div>
    </section>
    <div className="admin-analytics-secondary">
      <section className="admin-analytics-mini"><span className="admin-analytics-label"><FileText size={16} />文章点击量</span><strong className="admin-analytics-value" data-testid="article-clicks">{value(data?.articleClicks)}</strong><span className="admin-analytics-period">最近 {days} 天 · 详情打开次数</span></section>
      <section className="admin-analytics-mini"><span className="admin-analytics-label"><FolderGit2 size={16} />项目点击量</span><strong className="admin-analytics-value" data-testid="project-clicks">{value(data?.projectClicks)}</strong><span className="admin-analytics-period">最近 {days} 天 · 详情打开次数</span></section>
    </div>
  </div>;
}

function chartPath(points: AnalyticsDailyPoint[], field: 'pageViews' | 'articleClicks' | 'projectClicks', max: number) {
  return points.map((point, index) => `${index ? 'L' : 'M'}${(44 + index / Math.max(1, points.length - 1) * 612).toFixed(1)},${(214 - point[field] / max * 176).toFixed(1)}`).join(' ');
}

export function AnalyticsTrend({ daily }: { daily: AnalyticsDailyPoint[] }) {
  const rawMax = Math.max(1, ...daily.map(point => Math.max(point.pageViews, point.articleClicks, point.projectClicks)));
  const max = Math.max(4, Math.ceil(rawMax / 4) * 4);
  const ticks = daily.filter((_, index) => index === 0 || index === Math.floor((daily.length - 1) / 2) || index === daily.length - 1);
  const hasActivity = daily.some(point => point.pageViews + point.articleClicks + point.projectClicks > 0);
  const series = [{ key: 'pageViews', label: '网站浏览', className: 'is-views' }, { key: 'articleClicks', label: '文章点击', className: 'is-articles' }, { key: 'projectClicks', label: '项目点击', className: 'is-projects' }] as const;
  return <section className="admin-card admin-analytics-trend" aria-label="访问趋势">
    <div className="admin-card-header"><div><h2 className="admin-card-title">访问趋势</h2><p className="admin-card-description">每天的浏览与内容点击</p></div><div className="admin-chart-legend">{series.map(item => <span key={item.key} className={item.className}><i />{item.label}</span>)}</div></div>
    <svg className="admin-analytics-chart" viewBox="0 0 680 256" role="img" aria-label={hasActivity ? '每日网站浏览、文章点击和项目点击的折线图，详细数值见下方每日数据' : '当前时段还没有访问记录'}>
      {[0, 1, 2, 3, 4].map(index => <g key={index}><line x1="44" x2="656" y1={214 - index * 44} y2={214 - index * 44} className="admin-chart-grid" /><text x="34" y={218 - index * 44} textAnchor="end" className="admin-chart-tick">{formatMetric(max * index / 4)}</text></g>)}
      {series.map(item => <path key={item.key} d={chartPath(daily, item.key, max)} className={`admin-chart-line ${item.className}`} />)}
      {ticks.map(point => <text key={point.date} x={44 + daily.indexOf(point) / Math.max(1, daily.length - 1) * 612} y="244" textAnchor="middle" className="admin-chart-tick">{point.date.slice(5).replace('-', '/')}</text>)}
    </svg>
    {!hasActivity && <p className="admin-analytics-empty-note">有了新的访问，趋势就会出现在这里。</p>}
    <details className="admin-analytics-daily"><summary>查看每日数据</summary><div className="admin-table-container"><table className="admin-table"><caption className="admin-visually-hidden">按北京时间统计的每日访问量</caption><thead><tr><th scope="col">日期</th><th scope="col">网站浏览</th><th scope="col">文章点击</th><th scope="col">项目点击</th></tr></thead><tbody>{daily.map(point => <tr key={point.date}><td>{point.date}</td><td>{formatMetric(point.pageViews)}</td><td>{formatMetric(point.articleClicks)}</td><td>{formatMetric(point.projectClicks)}</td></tr>)}</tbody></table></div></details>
  </section>;
}

export function AnalyticsDistribution({ articles, projects }: { articles: number; projects: number }) {
  const total = articles + projects;
  const articleRatio = total ? articles / total * 100 : 0;
  return <section className="admin-card admin-analytics-distribution"><div className="admin-card-header"><div><h2 className="admin-card-title">内容点击分布</h2><p className="admin-card-description">看看访客更常打开什么</p></div></div>
    <div className="admin-analytics-donut" role="img" aria-label={total ? `文章 ${formatMetric(articles)} 次，项目 ${formatMetric(projects)} 次` : '当前时段还没有内容点击'}><svg viewBox="0 0 160 160" aria-hidden="true"><circle cx="80" cy="80" r="58" className="admin-donut-base" />{total > 0 && <><circle cx="80" cy="80" r="58" pathLength="100" className="admin-donut-projects" /><circle cx="80" cy="80" r="58" pathLength="100" strokeDasharray={`${articleRatio} 100`} className="admin-donut-articles" /></>}</svg><div><strong>{formatMetric(total)}</strong><span>内容点击</span></div></div>
    <div className="admin-analytics-distribution-values"><div className="is-articles"><span><i />文章</span><strong>{formatMetric(articles)}</strong></div><div className="is-projects"><span><i />项目</span><strong>{formatMetric(projects)}</strong></div></div>
  </section>;
}

export function AnalyticsContentTable({ articles, projects, days }: { articles: AnalyticsContentItem[]; projects: AnalyticsContentItem[]; days: number }) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [page, setPage] = useState(1);
  const rows = [ ...articles.map(item => ({ ...item, type: 'article' as const })), ...projects.map(item => ({ ...item, type: 'project' as const })) ]
    .filter(item => (type === 'all' || item.type === type) && `${item.title} ${item.slug}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    .sort((a, b) => b.clicks - a.clicks || b.totalClicks - a.totalClicks || a.title.localeCompare(b.title, 'zh-CN'));
  const totalPages = Math.max(1, Math.ceil(rows.length / 10));
  const currentPage = Math.min(page, totalPages);
  const visibleRows = rows.slice((currentPage - 1) * 10, currentPage * 10);
  return <section className="admin-card admin-analytics-content" aria-label="每篇内容点击量">
    <div className="admin-card-header"><div><h2 className="admin-card-title">每篇内容的表现</h2><p className="admin-card-description">按最近 {days} 天点击量排列，包含零点击内容。</p></div><div className="admin-analytics-content-controls"><label className="admin-search-field"><Search size={16} /><input className="admin-input" aria-label="搜索统计内容" placeholder="搜索标题或链接名" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} /></label><select className="admin-select" aria-label="统计内容类型" value={type} onChange={event => { setType(event.target.value); setPage(1); }}><option value="all">全部内容</option><option value="article">文章</option><option value="project">项目</option></select></div></div>
    <div className="admin-table-container"><table className="admin-table"><caption className="admin-visually-hidden">每篇文章和项目的时段点击量与累计点击量</caption><thead><tr><th scope="col">内容</th><th scope="col">类型</th><th scope="col">状态</th><th scope="col">最近 {days} 天</th><th scope="col">累计点击</th><th scope="col"><span className="admin-visually-hidden">操作</span></th></tr></thead><tbody>{visibleRows.map(item => <tr key={`${item.type}-${item.id}`}><td><Link className="admin-analytics-content-title" to={`/admin/${item.type === 'article' ? 'articles' : 'projects'}/${item.id}`}>{item.title || '未命名内容'}</Link><span className="admin-analytics-content-slug">{item.slug}</span></td><td>{item.type === 'article' ? '文章' : '项目'}</td><td><ContentStatusBadge status={item.status} /></td><td className="admin-analytics-count">{formatMetric(item.clicks)}</td><td>{formatMetric(item.totalClicks)}</td><td><Link className="admin-btn admin-btn-secondary admin-btn-sm" aria-label={`编辑${item.title}`} to={`/admin/${item.type === 'article' ? 'articles' : 'projects'}/${item.id}`}><ArrowUpRight size={15} /></Link></td></tr>)}</tbody></table>{rows.length === 0 && <div className="admin-empty-state"><p>{query || type !== 'all' ? '没有匹配的内容，请调整筛选。' : '新建文章或项目后，会在这里显示点击量。'}</p></div>}</div>
    {rows.length > 0 && <div className="admin-analytics-pagination"><span>共 {rows.length} 篇 · 第 {currentPage} / {totalPages} 页</span><div><button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>上一页</button><button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>下一页</button></div></div>}
  </section>;
}
