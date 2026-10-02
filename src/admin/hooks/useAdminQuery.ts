import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react';
import { getErrorMessage } from '../lib/feedback';

// Keep queries local to their page so admin records never survive logout or
// leak into the public site's fallback data. Only the latest request may commit.
export function useAdminQuery<T>(load: () => Promise<T>, initialData: T | (() => T), fallbackError: string) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const mounted = useRef(false);

  const reload = useCallback(async () => {
    if (!mounted.current) return;
    const request = ++generation.current;
    setLoading(true);
    setError(null);
    try {
      const result = await load();
      if (mounted.current && request === generation.current) setData(result);
    } catch (failure) {
      if (mounted.current && request === generation.current) setError(getErrorMessage(failure, fallbackError));
    } finally {
      if (mounted.current && request === generation.current) setLoading(false);
    }
  }, [load, fallbackError]);

  const deactivate = useCallback(() => { mounted.current = false; ++generation.current; }, []);

  useEffect(() => {
    let active = true;
    mounted.current = true;
    queueMicrotask(() => { if (active) void reload(); });
    return () => { active = false; deactivate(); };
  }, [reload, deactivate]);

  const updateData = useCallback((value: SetStateAction<T>) => {
    if (!mounted.current) return;
    // A completed mutation must not be overwritten by an older refresh.
    ++generation.current;
    setData(value);
    setLoading(false);
  }, []);

  return { data, setData: updateData, loading, error, reload };
}
