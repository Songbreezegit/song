import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, createThemeTransition, readStoredTheme } from '../src/context/themeTransition';

function deferred() {
  let resolve!: () => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

describe('theme transition', () => {
  let classes: Set<string>;
  let storage: Map<string, string>;
  let animate: ReturnType<typeof vi.fn>;
  let animationCancel: ReturnType<typeof vi.fn>;
  let start: ReturnType<typeof vi.fn>;
  let ready: ReturnType<typeof deferred>;
  let finished: ReturnType<typeof deferred>;
  let skip: ReturnType<typeof vi.fn>;
  let marker: { className: string; setAttribute: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn>; getBoundingClientRect: ReturnType<typeof vi.fn> };
  let snapshot: { width?: number; height?: number; x: number; y: number };
  let markerOffset: { x: number; y: number };

  beforeEach(() => {
    classes = new Set();
    storage = new Map();
    ready = deferred();
    finished = deferred();
    snapshot = { x: 0, y: 0 };
    markerOffset = { x: 0, y: 0 };
    marker = { className: '', setAttribute: vi.fn(), remove: vi.fn(), getBoundingClientRect: vi.fn(() => ({ left: 0, top: 0 })) };
    animationCancel = vi.fn();
    animate = vi.fn(() => ({ cancel: animationCancel }));
    skip = vi.fn(() => finished.resolve());
    start = vi.fn((update: () => void) => {
      update();
      return {
        ready: ready.promise,
        finished: finished.promise,
        updateCallbackDone: Promise.resolve(),
        skipTransition: skip,
      };
    });
    vi.stubGlobal('document', {
      documentElement: {
        classList: {
          add: (name: string) => classes.add(name),
          remove: (name: string) => classes.delete(name),
          toggle: (name: string, enabled: boolean) => enabled ? classes.add(name) : classes.delete(name),
        },
        animate,
      },
      startViewTransition: start,
      createElement: vi.fn(() => marker),
      body: { append: vi.fn() },
    });
    vi.stubGlobal('window', {
      innerWidth: 1440,
      innerHeight: 900,
      matchMedia: vi.fn(() => ({ matches: false })),
      getComputedStyle: vi.fn((_root, pseudo) => pseudo === '::view-transition-group(root)' ? {
        width: `${snapshot.width ?? window.innerWidth}px`, height: `${snapshot.height ?? window.innerHeight}px`,
        transform: `matrix(1, 0, 0, 1, ${snapshot.x}, ${snapshot.y})`,
      } : { transform: `matrix(1, 0, 0, 1, ${markerOffset.x}, ${markerOffset.y})` }),
    });
    vi.stubGlobal('DOMMatrixReadOnly', class {
      e: number;
      f: number;
      constructor(transform: string) {
        const values = transform.slice(7, -1).split(',').map(Number);
        this.e = values[4]; this.f = values[5];
      }
    });
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('restores only valid saved themes, defaulting to light', () => {
    expect(readStoredTheme()).toBe('light');
    storage.set('song_theme', 'dark');
    expect(readStoredTheme()).toBe('dark');
    storage.set('song_theme', 'light');
    expect(readStoredTheme()).toBe('light');
    storage.set('song_theme', 'unknown');
    expect(readStoredTheme()).toBe('light');
    expect(start).not.toHaveBeenCalled();
  });

  for (const theme of ['dark', 'light'] as const) {
    it(`commits ${theme} class and storage before the new snapshot`, async () => {
      applyTheme(theme === 'dark' ? 'light' : 'dark');
      const controller = createThemeTransition();
      controller.toggle(() => applyTheme(theme), { x: 1300, y: 42 });
      expect(classes.has('dark')).toBe(theme === 'dark');
      expect(storage.get('song_theme')).toBe(theme);
      expect(classes.has('theme-transitioning')).toBe(true);
      expect(animate).not.toHaveBeenCalled();
      ready.resolve();
      await ready.promise;
      expect(classes.has('theme-transitioning')).toBe(false);
      expect(animate).toHaveBeenCalledOnce();
      finished.resolve();
      await finished.promise;
      expect(animationCancel).toHaveBeenCalledOnce();
      expect(marker.remove).toHaveBeenCalledOnce();
    });
  }

  for (const viewport of [
    { width: 2560, height: 1080 },
    { width: 1920, height: 1080 },
    { width: 1024, height: 768 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 960, height: 540 },
  ]) {
    it(`covers every corner at ${viewport.width}x${viewport.height}`, async () => {
      window.innerWidth = viewport.width;
      window.innerHeight = viewport.height;
      const origin = { x: viewport.width - 70.5, y: 42.25 };
      const radius = Math.hypot(Math.max(origin.x, viewport.width - origin.x), Math.max(origin.y, viewport.height - origin.y)) + 2;
      createThemeTransition().toggle(() => applyTheme('dark'), origin);
      ready.resolve();
      await ready.promise;
      expect(start).toHaveBeenCalledOnce();
      expect(animate).toHaveBeenCalledWith({ clipPath: [
        `circle(0px at ${origin.x}px ${origin.y}px)`,
        `circle(${radius}px at ${origin.x}px ${origin.y}px)`,
      ] }, {
        duration: 520,
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
        fill: 'both',
        pseudoElement: '::view-transition-new(root)',
      });
      for (const x of [0, viewport.width]) for (const y of [0, viewport.height]) {
        expect(radius).toBeGreaterThan(Math.hypot(x - origin.x, y - origin.y));
      }
    });
  }

  it('defaults to the viewport center when no origin is provided', async () => {
    createThemeTransition().toggle(() => applyTheme('dark'));
    ready.resolve();
    await ready.promise;
    expect(animate.mock.calls[0][0].clipPath[0]).toBe('circle(0px at 720px 450px)');
  });

  for (const bars of [
    { top: 56, bottom: 0 }, { top: 0, bottom: 56 },
    { top: 56, bottom: 48 }, { top: 28, bottom: 0 },
  ]) {
    it(`maps the button center and covers mobile snapshots with ${bars.top}px top / ${bars.bottom}px bottom browser UI`, async () => {
      window.innerWidth = 390; window.innerHeight = 844;
      const origin = { x: 280, y: 42 };
      createThemeTransition().toggle(() => applyTheme('dark'), origin);
      // Geometry is read after capture; browser chrome can change before ready.
      markerOffset.y = bars.top;
      snapshot.width = 390; snapshot.height = 844 + bars.top + bars.bottom;
      ready.resolve();
      await ready.promise;
      const x = origin.x, y = origin.y + bars.top;
      const radius = Math.hypot(Math.max(x, 390 - x), Math.max(y, snapshot.height - y)) + 2;
      expect(animate.mock.calls[0][0].clipPath).toEqual([
        `circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`,
      ]);
      for (const cornerX of [0, 390]) for (const cornerY of [0, snapshot.height]) {
        expect(radius).toBeGreaterThan(Math.hypot(cornerX - x, cornerY - y));
      }
    });
  }

  it('keeps fixed-marker and snapshot translations in the same coordinate space', async () => {
    marker.getBoundingClientRect.mockReturnValue({ left: 4, top: 8 });
    markerOffset = { x: 20, y: 70 };
    snapshot = { width: 1456, height: 962, x: 2, y: 3 };
    createThemeTransition().toggle(() => applyTheme('dark'), { x: 1300, y: 42 });
    ready.resolve();
    await ready.promise;
    expect(animate.mock.calls[0][0].clipPath[0]).toBe('circle(0px at 1314px 101px)');
  });

  it('skips a snapshot whose geometry cannot be measured and removes its marker', async () => {
    snapshot.height = NaN;
    createThemeTransition().toggle(() => applyTheme('dark'));
    ready.resolve();
    await ready.promise;
    await finished.promise;
    expect(animate).not.toHaveBeenCalled();
    expect(skip).toHaveBeenCalledOnce();
    expect(marker.remove).toHaveBeenCalledOnce();
    expect(storage.get('song_theme')).toBe('dark');
  });

  for (const fallback of ['unsupported', 'reduced motion', 'missing Web Animations'] as const) {
    it(`switches both ways without a snapshot for ${fallback}`, () => {
      if (fallback === 'unsupported') document.startViewTransition = undefined!;
      if (fallback === 'reduced motion') vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as MediaQueryList);
      if (fallback === 'missing Web Animations') document.documentElement.animate = undefined!;
      const controller = createThemeTransition();
      controller.toggle(() => applyTheme('dark'));
      expect(classes.has('dark')).toBe(true);
      expect(storage.get('song_theme')).toBe('dark');
      controller.toggle(() => applyTheme('light'));
      expect(classes.has('dark')).toBe(false);
      expect(storage.get('song_theme')).toBe('light');
      expect(start).not.toHaveBeenCalled();
      expect(animate).not.toHaveBeenCalled();
      expect(classes.has('theme-transitioning')).toBe(false);
      expect(document.createElement).not.toHaveBeenCalled();
    });
  }

  it('ignores repeat requests through capture and playback, then accepts the next', async () => {
    const controller = createThemeTransition();
    const update = vi.fn(() => applyTheme('dark'));
    controller.toggle(update);
    controller.toggle(() => applyTheme('light'));
    ready.resolve();
    await ready.promise;
    controller.toggle(() => applyTheme('light'));
    expect(start).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledOnce();
    expect(storage.get('song_theme')).toBe('dark');
    finished.resolve();
    await finished.promise;
    controller.toggle(() => applyTheme('light'));
    expect(start).toHaveBeenCalledTimes(2);
    expect(classes.has('dark')).toBe(false);
    expect(storage.get('song_theme')).toBe('light');
  });

  it('keeps switching when storage reads and writes throw', () => {
    vi.mocked(localStorage.getItem).mockImplementation(() => { throw new Error('Storage blocked'); });
    vi.mocked(localStorage.setItem).mockImplementation(() => { throw new Error('Storage blocked'); });
    document.startViewTransition = undefined!;
    expect(readStoredTheme()).toBe('light');
    const controller = createThemeTransition();
    expect(() => controller.toggle(() => applyTheme('dark'))).not.toThrow();
    expect(classes.has('dark')).toBe(true);
    controller.toggle(() => applyTheme('light'));
    expect(classes.has('dark')).toBe(false);
  });

  it('falls back and releases the lock if starting the transition throws', () => {
    start.mockImplementation(() => { throw new Error('Transition unavailable'); });
    const controller = createThemeTransition();
    controller.toggle(() => applyTheme('dark'));
    expect(classes.has('dark')).toBe(true);
    expect(classes.has('theme-transitioning')).toBe(false);
    expect(marker.remove).toHaveBeenCalledOnce();
    controller.toggle(() => applyTheme('light'));
    expect(classes.has('dark')).toBe(false);
  });

  it('cleans up a rejected snapshot and unlocks after the transition finishes', async () => {
    const controller = createThemeTransition();
    controller.toggle(() => applyTheme('dark'));
    ready.reject(new Error('Snapshot skipped'));
    await ready.promise.catch(() => {});
    expect(animate).not.toHaveBeenCalled();
    expect(classes.has('theme-transitioning')).toBe(false);
    expect(storage.get('song_theme')).toBe('dark');
    finished.resolve();
    await finished.promise;
    document.startViewTransition = undefined!;
    controller.toggle(() => applyTheme('light'));
    expect(classes.has('dark')).toBe(false);
  });

  it('skips the enhancement when the pseudo-element animation fails', async () => {
    animate.mockImplementation(() => { throw new Error('Animation unavailable'); });
    const controller = createThemeTransition();
    controller.toggle(() => applyTheme('dark'));
    ready.resolve();
    await ready.promise;
    await finished.promise;
    expect(skip).toHaveBeenCalledOnce();
    expect(classes.has('theme-transitioning')).toBe(false);
    expect(storage.get('song_theme')).toBe('dark');
    document.startViewTransition = undefined!;
    controller.toggle(() => applyTheme('light'));
    expect(classes.has('dark')).toBe(false);
  });

  it('cancels on unmount without committing a delayed callback or animating', async () => {
    let update!: () => void;
    start.mockImplementation((callback: () => void) => {
      update = callback;
      return { ready: ready.promise, finished: finished.promise, updateCallbackDone: Promise.resolve(), skipTransition: skip };
    });
    const controller = createThemeTransition();
    controller.toggle(() => applyTheme('dark'));
    controller.cancel();
    update();
    ready.resolve();
    await ready.promise;
    expect(skip).toHaveBeenCalledOnce();
    expect(animate).not.toHaveBeenCalled();
    expect(classes.has('dark')).toBe(false);
    expect(classes.has('theme-transitioning')).toBe(false);
    expect(marker.remove).toHaveBeenCalled();
  });
});
