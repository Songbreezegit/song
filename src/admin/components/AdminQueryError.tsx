import { AdminFeedback } from './AdminFeedback';

export function AdminQueryError({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  if (!error) return null;
  return (
    <div>
      <AdminFeedback feedback={{ type: 'error', message: error }} />
      <button type="button" className="admin-btn admin-btn-secondary" onClick={onRetry}>重新加载</button>
    </div>
  );
}
