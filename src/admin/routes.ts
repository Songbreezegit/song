import { lazy, type ComponentType } from 'react';
import { matchPath } from 'react-router-dom';
import { LayoutDashboard, FolderGit2, FileText, Sliders, Image, Share2, type LucideIcon } from 'lucide-react';

export const ADMIN_HOME = '/admin/dashboard';
export const ADMIN_LOGIN = '/admin/login';

interface AdminRoute {
  path: string;
  title: string;
  component: ComponentType;
  navigation?: { label: string; icon: LucideIcon };
}

const ProjectEditor = lazy(() => import('./pages/AdminProjectEditor').then(m => ({ default: m.AdminProjectEditor })));
const ArticleEditor = lazy(() => import('./pages/AdminArticleEditor').then(m => ({ default: m.AdminArticleEditor })));

// This registry owns page loading, sidebar entries and header titles.
export const adminRoutes: AdminRoute[] = [
  { path: 'dashboard', title: '网站仪表盘', component: lazy(() => import('./pages/AdminDashboard').then(m => ({ default: m.AdminDashboard }))), navigation: { label: '仪表盘', icon: LayoutDashboard } },
  { path: 'projects', title: '项目管理', component: lazy(() => import('./pages/AdminProjects').then(m => ({ default: m.AdminProjects }))), navigation: { label: '项目管理', icon: FolderGit2 } },
  { path: 'projects/new', title: '新建项目', component: ProjectEditor },
  { path: 'projects/:id', title: '编辑项目', component: ProjectEditor },
  { path: 'articles', title: '文章管理', component: lazy(() => import('./pages/AdminArticles').then(m => ({ default: m.AdminArticles }))), navigation: { label: '文章管理', icon: FileText } },
  { path: 'articles/new', title: '新建文章', component: ArticleEditor },
  { path: 'articles/:id', title: '编辑文章', component: ArticleEditor },
  { path: 'distribution', title: '内容分发', component: lazy(() => import('./pages/AdminDistribution').then(m => ({ default: m.AdminDistribution }))), navigation: { label: '内容分发', icon: Share2 } },
  { path: 'distribution/posts', title: '分发内容库', component: lazy(() => import('./pages/AdminDistributionPosts').then(m => ({ default: m.AdminDistributionPosts }))) },
  { path: 'distribution/posts/new', title: '新建分发内容', component: lazy(() => import('./pages/AdminDistributionPostEditor').then(m => ({ default: m.AdminDistributionPostEditor }))) },
  { path: 'distribution/posts/:id', title: '编辑分发内容', component: lazy(() => import('./pages/AdminDistributionPostEditor').then(m => ({ default: m.AdminDistributionPostEditor }))) },
  { path: 'distribution/posts/:id/variants', title: '平台版本', component: lazy(() => import('./pages/AdminDistributionVariants').then(m => ({ default: m.AdminDistributionVariants }))) },
  { path: 'distribution/posts/:id/variants/:variantId', title: '编辑平台稿', component: lazy(() => import('./pages/AdminDistributionVariantEditor').then(m => ({ default: m.AdminDistributionVariantEditor }))) },
  { path: 'distribution/calendar', title: '发布日历', component: lazy(() => import('./pages/AdminDistributionPublishCalendar').then(m => ({ default: m.AdminDistributionPublishCalendar }))) },
  { path: 'distribution/calendar/new', title: '新建发布任务', component: lazy(() => import('./pages/AdminDistributionPublishNew').then(m => ({ default: m.AdminDistributionPublishNew }))) },
  { path: 'distribution/calendar/:taskId', title: '发布任务详情', component: lazy(() => import('./pages/AdminDistributionPublishTask').then(m => ({ default: m.AdminDistributionPublishTask }))) },
  { path: 'distribution/history', title: '发布历史', component: lazy(() => import('./pages/AdminDistributionPublishCalendar').then(m => ({ default: m.AdminDistributionPublishHistory }))) },
  { path: 'distribution/accounts', title: '矩阵账号', component: lazy(() => import('./pages/AdminDistributionAccounts').then(m => ({ default: m.AdminDistributionAccounts }))) },
  { path: 'distribution/accounts/new', title: '新增矩阵账号', component: lazy(() => import('./pages/AdminDistributionAccountEditor').then(m => ({ default: m.AdminDistributionAccountEditor }))) },
  { path: 'distribution/accounts/:id', title: '编辑矩阵账号', component: lazy(() => import('./pages/AdminDistributionAccountEditor').then(m => ({ default: m.AdminDistributionAccountEditor }))) },
  { path: 'site', title: '站点设置', component: lazy(() => import('./pages/AdminSiteSettings').then(m => ({ default: m.AdminSiteSettings }))), navigation: { label: '站点设置', icon: Sliders } },
  { path: 'media', title: '媒体库', component: lazy(() => import('./pages/AdminMedia').then(m => ({ default: m.AdminMedia }))), navigation: { label: '媒体库', icon: Image } },
];

export function getAdminPageTitle(pathname: string): string {
  return adminRoutes.find(route => matchPath({ path: `/admin/${route.path}`, end: true }, pathname))?.title || '管理控制台';
}

export function getAdminReturnPath(from: unknown): string {
  if (!from || typeof from !== 'object' || !('pathname' in from) || typeof from.pathname !== 'string') return ADMIN_HOME;
  if (!from.pathname.startsWith('/admin/') || matchPath('/admin/login/*', from.pathname)) return ADMIN_HOME;
  const search = 'search' in from && typeof from.search === 'string' && from.search.startsWith('?') ? from.search : '';
  const hash = 'hash' in from && typeof from.hash === 'string' && from.hash.startsWith('#') ? from.hash : '';
  return `${from.pathname}${search}${hash}`;
}
