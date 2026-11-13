import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { CalendarDays, FileEdit, History, LayoutDashboard, Users } from 'lucide-react';
import type { DistributionPostStatus } from '../../../types/distribution';
import { postStatusLabels } from './distributionForm';
import { publishCalendarPath, publishHistoryPath } from './publishPaths';

export function DistributionTabs() {
  return <nav className="distribution-tabs" aria-label="内容分发导航">
    {[{ to: '/admin/distribution', label: '概览', Icon: LayoutDashboard }, { to: '/admin/distribution/posts', label: '内容库', Icon: FileEdit },
      { to: '/admin/distribution/accounts', label: '矩阵账号', Icon: Users }, { to: publishCalendarPath, label: '发布日历', Icon: CalendarDays },
      { to: publishHistoryPath, label: '发布历史', Icon: History }].map(({ to, label, Icon }, index) =>
      <NavLink key={to} to={to} end={index === 0} className={({ isActive }) => `distribution-tab${isActive ? ' is-active' : ''}`}><Icon size={16} />{label}</NavLink>)}
  </nav>;
}

export function DistributionStatus({ status }: { status: DistributionPostStatus }) {
  return <span className={`admin-status-badge ${status === 'draft' ? 'admin-status-draft' : 'distribution-ready'}`}><span aria-hidden="true" className="admin-status-dot" />{postStatusLabels[status]}</span>;
}

export function DistributionEmpty({ title, description, to, action }: { title: string; description: string; to?: string; action?: string }) {
  return <div className="admin-empty-state"><div className="admin-empty-icon"><FileEdit size={26} /></div><h3>{title}</h3><p>{description}</p>
    {to && <Link className="admin-btn admin-btn-primary" to={to}>{action}</Link>}</div>;
}

export function DistributionField({ id, label, children, help }: { id: string; label: string; children: ReactNode; help?: string }) {
  return <div className="admin-form-group"><label className="admin-label" htmlFor={id}>{label}</label>{children}
    {help && <p className="admin-label-desc" id={`${id}-help`}>{help}</p>}</div>;
}
