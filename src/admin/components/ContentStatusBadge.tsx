import type { ContentStatus } from '../../types/database';

import { contentStatusLabels } from '../lib/collection';

export function ContentStatusBadge({ status }: { status: ContentStatus }) {
  return <span className={`admin-status-badge admin-status-${status}`}>
    <span aria-hidden="true" className="admin-status-dot" />{contentStatusLabels[status]}
  </span>;
}
