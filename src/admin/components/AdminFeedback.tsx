import { AlertCircle, CheckCircle } from 'lucide-react';
import type { AdminFeedbackMessage } from '../lib/feedback';

export function AdminFeedback({ feedback }: { feedback: AdminFeedbackMessage | null }) {
  if (!feedback) return null;
  return (
    <div className={`admin-alert admin-alert-${feedback.type}`} role={feedback.type === 'error' ? 'alert' : 'status'}>
      {feedback.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
      <div>{feedback.message}</div>
    </div>
  );
}
