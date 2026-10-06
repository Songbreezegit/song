import type { ReactNode } from 'react';

export function AdminPageHeader({ eyebrow, title, description, actions }: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return <div className="admin-page-header">
    <div>
      {eyebrow && <span className="admin-page-eyebrow">{eyebrow}</span>}
      <h1>{title}</h1>
      {description && <p className="admin-page-description">{description}</p>}
    </div>
    {actions && <div className="admin-page-actions">{actions}</div>}
  </div>;
}
