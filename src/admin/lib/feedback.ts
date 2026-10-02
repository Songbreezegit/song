export interface AdminFeedbackMessage {
  type: 'success' | 'error';
  message: string;
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message || fallback;
  }
  return fallback;
}
