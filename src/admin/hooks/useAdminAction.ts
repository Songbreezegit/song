import { useCallback, useEffect, useRef, useState } from 'react';
import { getErrorMessage, type AdminFeedbackMessage } from '../lib/feedback';

interface ActionOptions<T> {
  successMessage?: string;
  onSuccess?: (value: T) => void | Promise<void>;
}

export function useAdminAction(fallbackError = '操作失败，请重试。') {
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [feedback, setFeedbackState] = useState<AdminFeedbackMessage | null>(null);
  const mounted = useRef(false);
  const pending = useRef<symbol | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; pending.current = null; };
  }, []);

  const setFeedback = useCallback((value: AdminFeedbackMessage | null) => {
    if (mounted.current) setFeedbackState(value);
  }, []);

  const run = useCallback(async <T,>(key: string, operation: () => Promise<T>, options: ActionOptions<T> = {}) => {
    // A ref closes the interval before React commits the disabled button.
    if (!mounted.current || pending.current) return false;
    const action = Symbol(key);
    pending.current = action;
    setPendingKey(key);
    setFeedbackState(null);
    try {
      const value = await operation();
      if (!mounted.current || pending.current !== action) return false;
      await options.onSuccess?.(value);
      if (mounted.current && pending.current === action && options.successMessage) {
        setFeedbackState({ type: 'success', message: options.successMessage });
      }
      return true;
    } catch (error) {
      if (mounted.current && pending.current === action) {
        setFeedbackState({ type: 'error', message: getErrorMessage(error, fallbackError) });
      }
      return false;
    } finally {
      if (mounted.current && pending.current === action) {
        pending.current = null;
        setPendingKey(null);
      }
    }
  }, [fallbackError]);

  return { pendingKey, feedback, setFeedback, run };
}
