import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { createIdleSession } from './idleSession';
import { getSessionIdentity } from './mfa';

export function useAdminIdleSession(session: Session | null, enabled: boolean, onExpire: () => void) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const identity = getSessionIdentity(session);
  const key = identity ? `song-admin-activity:${identity}` : null;
  useEffect(() => {
    if (!enabled) return;
    const read = () => {
      try {
        const value = key ? localStorage.getItem(key) : null;
        return value === null ? null : Number(value);
      } catch { return null; }
    };
    const write = (time: number) => { try { if (key) localStorage.setItem(key, String(time)); } catch { /* In-memory timer still works when storage is unavailable. */ } };
    const idle = createIdleSession({ now: Date.now, read, write, warn: setRemaining, expire: onExpire });
    const activity = (event: Event) => { if (event.isTrusted && document.visibilityState === 'visible') idle.activity(); };
    const check = () => { idle.check(); };
    const storage = (event: StorageEvent) => { if (event.key === key) check(); };
    const events = ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart'] as const;
    events.forEach(event => document.addEventListener(event, activity, { passive: true, capture: true }));
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    window.addEventListener('storage', storage);
    const timer = window.setInterval(check, 1000);
    check();
    return () => {
      window.clearInterval(timer);
      events.forEach(event => document.removeEventListener(event, activity, true));
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
      window.removeEventListener('storage', storage);
    };
  }, [enabled, key, onExpire]);
  return enabled ? remaining : null;
}
