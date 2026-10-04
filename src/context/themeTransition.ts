import type { Theme, ThemeTransitionOrigin } from './ThemeContextDefinition';

export function readStoredTheme(): Theme {
  try {
    const saved = localStorage.getItem('song_theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* Theme works when storage is unavailable. */ }
  return 'light';
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  try { localStorage.setItem('song_theme', theme); } catch { /* Persistence is optional. */ }
}

type ActiveTransition = {
  cancelled: boolean;
  transition?: ViewTransition;
  animation?: Animation;
};

// Each provider owns one transition; requests during capture or playback are ignored.
export function createThemeTransition() {
  let active: ActiveTransition | null = null;

  return {
    toggle(updateTheme: () => void, origin?: ThemeTransitionOrigin) {
      if (active) return;

      const root = document.documentElement;
      if (
        typeof document.startViewTransition !== 'function' ||
        typeof root.animate !== 'function' ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        updateTheme();
        return;
      }

      const { x, y } = origin ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      const radius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y),
      ) + 2;
      const request: ActiveTransition = { cancelled: false };
      active = request;
      root.classList.add('theme-transitioning');

      const finish = () => {
        request.animation?.cancel();
        if (active !== request) return;
        root.classList.remove('theme-transitioning');
        active = null;
      };

      try {
        const transition = document.startViewTransition(() => {
          if (!request.cancelled) updateTheme();
        });
        request.transition = transition;

        void transition.ready.then(() => {
          if (request.cancelled) return;
          // Both snapshots now have stable colors. Restore the site's hover transitions.
          root.classList.remove('theme-transitioning');
          try {
            request.animation = root.animate({
              clipPath: [
                `circle(0px at ${x}px ${y}px)`,
                `circle(${radius}px at ${x}px ${y}px)`,
              ],
            }, {
              duration: 420,
              easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
              fill: 'both',
              pseudoElement: '::view-transition-new(root)',
            });
          } catch {
            // A failed enhancement must still leave the committed theme usable.
            transition.skipTransition();
          }
        }, () => {
          if (active === request) root.classList.remove('theme-transitioning');
        });
        void transition.finished.then(finish, finish);
        void transition.updateCallbackDone.catch(() => {});
      } catch {
        finish();
        updateTheme();
      }
    },
    cancel() {
      if (!active) return;
      active.cancelled = true;
      active.transition?.skipTransition();
      active.animation?.cancel();
      document.documentElement.classList.remove('theme-transitioning');
      active = null;
    },
  };
}
