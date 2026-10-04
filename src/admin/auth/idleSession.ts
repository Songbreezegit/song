export const ADMIN_IDLE_MS = 60 * 60 * 1000;
export const ADMIN_IDLE_WARNING_MS = 2 * 60 * 1000;

interface IdleOptions {
  now: () => number;
  read: () => number | null;
  write: (time: number) => void;
  warn: (remaining: number | null) => void;
  expire: () => void;
}

// Refreshing tokens, opening another tab, or focusing a sleeping tab is not
// activity. Read shared activity before every check to handle throttled tabs.
export function createIdleSession(options: IdleOptions) {
  const started = options.now();
  const stored = options.read();
  let last = stored !== null && Number.isFinite(stored) && stored >= 0 && stored <= started ? stored : started;
  let expired = false;
  options.write(last);
  const check = () => {
    if (expired) return false;
    const now = options.now();
    const shared = options.read();
    if (shared === 0) last = 0; // A previous tab already expired this session.
    else if (shared !== null && Number.isFinite(shared) && shared > last && shared <= now) last = shared;
    const remaining = ADMIN_IDLE_MS - (now - last);
    if (remaining <= 0) {
      expired = true;
      options.write(0);
      options.warn(null);
      options.expire();
      return false;
    }
    options.warn(remaining <= ADMIN_IDLE_WARNING_MS ? remaining : null);
    return true;
  };
  return { check, activity: () => {
    if (!check()) return;
    const now = options.now();
    // Limit cross-tab storage events for continuous typing/mouse movement.
    if (now - last >= 1000) { last = now; options.write(last); }
    options.warn(null);
  } };
}
