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
  originMarker?: HTMLElement;
  transition?: ViewTransition;
  animation?: Animation;
};

function revealGeometry(root: HTMLElement, marker: HTMLElement, origin: ThemeTransitionOrigin) {
  // Mobile snapshots include retractable browser chrome. A fixed, empty marker
  // lets the browser map viewport coordinates into that snapshot coordinate space.
  const markerRect = marker.getBoundingClientRect();
  const markerStyle = window.getComputedStyle(root, '::view-transition-group(theme-origin)');
  const snapshotStyle = window.getComputedStyle(root, '::view-transition-group(root)');
  const markerTransform = new DOMMatrixReadOnly(markerStyle.transform);
  const snapshotTransform = new DOMMatrixReadOnly(snapshotStyle.transform);
  const width = Number.parseFloat(snapshotStyle.width);
  const height = Number.parseFloat(snapshotStyle.height);
  const x = origin.x + markerTransform.e - markerRect.left - snapshotTransform.e;
  const y = origin.y + markerTransform.f - markerRect.top - snapshotTransform.f;
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
    throw new Error('Theme snapshot geometry is unavailable');
  }
  return {
    x, y,
    radius: Math.hypot(Math.max(x, width - x), Math.max(y, height - y)) + 2,
  };
}

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

      const viewportOrigin = origin ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      const request: ActiveTransition = { cancelled: false };
      active = request;
      root.classList.add('theme-transitioning');

      const finish = () => {
        request.animation?.cancel();
        request.originMarker?.remove();
        if (active !== request) return;
        root.classList.remove('theme-transitioning');
        active = null;
      };

      try {
        const marker = document.createElement('div');
        request.originMarker = marker;
        marker.className = 'theme-transition-origin';
        marker.setAttribute('aria-hidden', 'true');
        document.body.append(marker);
        const transition = document.startViewTransition(() => {
          if (!request.cancelled) updateTheme();
        });
        request.transition = transition;

        void transition.ready.then(() => {
          if (request.cancelled) return;
          // Both snapshots now have stable colors. Restore the site's hover transitions.
          root.classList.remove('theme-transitioning');
          try {
            const { x, y, radius } = revealGeometry(root, marker, viewportOrigin);
            request.animation = root.animate({
              clipPath: [
                `circle(0px at ${x}px ${y}px)`,
                `circle(${radius}px at ${x}px ${y}px)`,
              ],
            }, {
              duration: 520,
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
      active.originMarker?.remove();
      document.documentElement.classList.remove('theme-transitioning');
      active = null;
    },
  };
}
