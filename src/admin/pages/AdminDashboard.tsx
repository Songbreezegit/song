import { Link } from 'react-router-dom';
import { FolderGit2, FileText, Plus, ArrowRight, Image, FileEdit, Globe, RefreshCw, Clock } from 'lucide-react';
import { fetchAdminDashboard, type AdminDashboardData } from '../../services/adminService';
import { useAdminQuery } from '../hooks/useAdminQuery';
import { AdminQueryError } from '../components/AdminQueryError';
import { AdminPageHeader } from '../components/AdminPageHeader';
import { ContentStatusBadge } from '../components/ContentStatusBadge';

const emptyDashboard: AdminDashboardData = { projects: { total: 0, published: 0, draft: 0 }, articles: { total: 0, published: 0, draft: 0 }, recentItems: [] };

export function AdminDashboard() {
  const { data, loading, error, reload } = useAdminQuery(fetchAdminDashboard, emptyDashboard, '统计加载失败，请重试。');
  const value = (count: number) => loading ? '…' : error ? '—' : count;
  const stats = [
    { label: '作品项目', count: data.projects.total, icon: FolderGit2, path: '/admin/projects', detail: `${data.projects.published} 已发布 · ${data.projects.draft} 草稿` },
    { label: '思考与笔记', count: data.articles.total, icon: FileText, path: '/admin/articles', detail: `${data.articles.published} 已发布 · ${data.articles.draft} 草稿` },
    { label: '项目草稿', count: data.projects.draft, icon: FileEdit, path: '/admin/projects?status=draft', detail: '继续完善作品介绍' },
    { label: '文章草稿', count: data.articles.draft, icon: FileEdit, path: '/admin/articles?status=draft', detail: '回到未完成的思考' },
  ];

  return <div>
    <AdminPageHeader eyebrow="CONTENT OVERVIEW" title="把想法，变成内容。" description="继续最近的创作，或开始一个新的项目与记录。"
      actions={<><Link to="/admin/projects/new" className="admin-btn admin-btn-primary"><Plus size={16} />新建项目</Link>
        <Link to="/admin/articles/new" className="admin-btn admin-btn-secondary"><Plus size={16} />新建文章</Link></>} />
    <AdminQueryError error={error} onRetry={reload} />
    <div className="admin-stats-grid">
      {stats.map(({ label, count, icon: Icon, path, detail }) => <Link key={label} to={path} className="admin-stat-card">
        <div className="admin-stat-heading"><span className="admin-stat-label">{label}</span><Icon size={18} /></div>
        <div className="admin-stat-value">{value(count)}</div>
        <div className="admin-stat-detail">{loading || error ? '正在获取内容状态' : detail}<ArrowRight size={14} /></div>
      </Link>)}
    </div>
    <div className="admin-dashboard-grid">
      <section className="admin-card admin-recent-card">
        <div className="admin-card-header"><div><h3 className="admin-card-title">最近内容变动</h3><p className="admin-card-description">按更新时间排列，快速接着编辑。</p></div>
          <button type="button" onClick={reload} disabled={loading} className="admin-btn admin-btn-secondary admin-btn-sm" aria-label="刷新内容概览"><RefreshCw size={14} />刷新</button>
        </div>
        {loading ? <div className="admin-loading-content"><div className="admin-spinner" />正在加载数据...</div> : error ? null
          : data.recentItems.length === 0 ? <div className="admin-empty-state"><div className="admin-empty-icon"><FileEdit size={26} /></div><h3>从第一份内容开始</h3><p>暂无更新记录。请新建项目或文章。</p><Link to="/admin/articles/new" className="admin-btn admin-btn-secondary"><Plus size={15} />开始写文章</Link></div>
          : <div className="admin-recent-list">{data.recentItems.map(item => <Link className="admin-recent-item" key={`${item.type}-${item.id}`} to={`/admin/${item.type === 'project' ? 'projects' : 'articles'}/${item.id}`}>
            <span className={`admin-content-icon ${item.type === 'article' ? 'is-article' : ''}`}>{item.type === 'project' ? <FolderGit2 size={20} /> : <FileText size={20} />}</span>
            <span className="admin-recent-copy"><strong>{item.title || '未命名内容'}</strong><span>{item.type === 'project' ? '项目' : '文章'}<span aria-hidden="true"> · </span><Clock size={12} />{new Date(item.updated_at).toLocaleDateString('zh-CN')}</span></span>
            <ContentStatusBadge status={item.status} /><ArrowRight size={16} />
          </Link>)}</div>}
      </section>
      <aside className="admin-dashboard-aside">
        <section className="admin-card admin-start-card"><span className="admin-page-eyebrow">YOUR NEXT STEP</span><h3>为创作留一点空间</h3><p>项目记录成果，文章整理思考。先存为草稿，准备好后再发布。</p>
          <Link to="/admin/articles/new" className="admin-btn admin-btn-primary">写一篇新文章<ArrowRight size={15} /></Link></section>
        <section className="admin-card"><h3 className="admin-card-title">常用入口</h3><div className="admin-shortcut-list">
          <Link to="/admin/projects?status=draft"><FileEdit size={17} /><span>项目草稿<span>继续完善作品介绍</span></span><ArrowRight size={15} /></Link>
          <Link to="/admin/articles?status=draft"><FileText size={17} /><span>文章草稿<span>回到未完成的思考</span></span><ArrowRight size={15} /></Link>
          <Link to="/admin/media"><Image size={17} /><span>媒体库<span>上传图片，复制链接复用</span></span><ArrowRight size={15} /></Link>
          <Link to="/admin/site"><Globe size={17} /><span>站点设置<span>更新介绍、近况与联系方式</span></span><ArrowRight size={15} /></Link>
        </div></section>
      </aside>
    </div>
  </div>;
}
