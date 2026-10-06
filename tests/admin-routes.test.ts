import { describe, expect, it } from 'vitest';
import { ADMIN_HOME, adminRoutes, getAdminPageTitle, getAdminReturnPath } from '../src/admin/routes';

describe('admin route metadata', () => {
  it.each([
    ['/admin/projects/new', '新建项目'], ['/admin/projects/some-id', '编辑项目'],
    ['/admin/articles/new', '新建文章'], ['/admin/articles/some-id', '编辑文章'],
    ['/admin/projects/', '项目管理'], ['/admin/articles', '文章管理'],
    ['/admin/dashboard', '网站仪表盘'], ['/admin/site', '站点设置'], ['/admin/media', '媒体库'],
  ])('matches %s precisely', (path, title) => expect(getAdminPageTitle(path)).toBe(title));

  it('keeps five sidebar entries in the same registry as their routes', () => {
    expect(adminRoutes.filter(route => route.navigation).map(route => route.path)).toEqual(['dashboard', 'projects', 'articles', 'site', 'media']);
    expect(adminRoutes.filter(route => route.navigation).map(route => route.navigation?.label)).toEqual(['仪表盘', '项目管理', '文章管理', '站点设置', '媒体库']);
    expect(new Set(adminRoutes.map(route => route.path)).size).toBe(adminRoutes.length);
  });

  it('preserves an internal protected destination including its query and hash', () => {
    expect(getAdminReturnPath({ pathname: '/admin/projects/new', search: '?from=list', hash: '#cover' })).toBe('/admin/projects/new?from=list#cover');
  });

  it.each([null, {}, { pathname: 'https://example.com' }, { pathname: '//example.com/admin' },
    { pathname: '/zh/' }, { pathname: '/admin/login' }, { pathname: '/admin/login/' }, { pathname: '/admin/login/nested' }])('rejects invalid login destinations: %j', from => {
    expect(getAdminReturnPath(from)).toBe(ADMIN_HOME);
  });
});
