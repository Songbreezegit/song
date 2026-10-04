import { test, expect, type Page, type TestInfo } from '@playwright/test';
import type { SupportedLanguage } from '../../src/i18n/types';

type ThemeMotion = {
  calls: number;
  finished: number;
  snapshots: { dark: boolean; stored: string | null; icon: string | null }[];
  reveals: {
    clipPath: string[];
    duration: EffectTiming['duration'];
    easing: EffectTiming['easing'];
    fill: EffectTiming['fill'];
    pseudoElement: string;
  }[];
};

declare global {
  interface Window {
    __themeMotion: ThemeMotion;
    __themeAnimation?: Animation;
    __pauseThemeReveal?: boolean;
  }
}

const offlineOrigin = 'http://127.0.0.1:5175';
const themeLabels = {
  zh: { dark: '切换浅色模式', light: '切换深色模式' },
  en: { dark: 'Switch to light mode', light: 'Switch to dark mode' },
  ja: { dark: 'ライトモードに切り替え', light: 'ダークモードに切り替え' },
};
const themeButton = (page: Page) => page.locator('.site-header .header-actions > button.icon-button').first();
const runtimeErrors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  runtimeErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
  await page.addInitScript(() => {
    sessionStorage.setItem('song-isle-intro', 'seen');
    window.__themeMotion = { calls: 0, finished: 0, snapshots: [], reveals: [] };
    const start = document.startViewTransition?.bind(document);
    if (start) {
      document.startViewTransition = (options) => {
        window.__themeMotion.calls++;
        const update = typeof options === 'function' ? options : options?.update;
        const transition = start(() => {
          const result = update?.();
          let stored: string | null = null;
          try { stored = localStorage.getItem('song_theme'); } catch { /* Test blocked storage. */ }
          window.__themeMotion.snapshots.push({
            dark: document.documentElement.classList.contains('dark'),
            stored,
            icon: document.querySelector('.header-actions > button.icon-button svg')?.getAttribute('class') ?? null,
          });
          return result;
        });
        void transition.finished.then(() => window.__themeMotion.finished++, () => window.__themeMotion.finished++);
        return transition;
      };
    }
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (keyframes, options) {
      const animation = animate.call(this, keyframes, options);
      if (options && typeof options !== 'number' && options.pseudoElement === '::view-transition-new(root)') {
        const effect = animation.effect as KeyframeEffect;
        const timing = effect.getTiming();
        window.__themeMotion.reveals.push({
          clipPath: effect.getKeyframes().map(frame => String(frame.clipPath)),
          duration: timing.duration,
          easing: timing.easing,
          fill: timing.fill,
          pseudoElement: options.pseudoElement,
        });
        window.__themeAnimation = animation;
        if (window.__pauseThemeReveal) { animation.pause(); animation.currentTime = 0; }
      }
      return animation;
    };
  });
});

test.afterEach(async ({ page }) => expect(runtimeErrors.get(page)).toEqual([]));

async function openPage(page: Page, language: SupportedLanguage, section = '') {
  await page.goto(`${offlineOrigin}/${language}/${section}`);
  await expect(themeButton(page)).toBeVisible();
  await expect(page.locator('.site-loader')).toHaveCount(0);
  await page.evaluate(async () => {
    await document.fonts.ready;
    let previous = scrollY;
    let stable = 0;
    for (let frame = 0; frame < 120; frame++) {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      stable = Math.abs(scrollY - previous) < 0.1 ? stable + 1 : 0;
      previous = scrollY;
      if (stable >= 6) break;
    }
  });
}

async function expectTheme(page: Page, theme: 'light' | 'dark', language: SupportedLanguage = 'zh', stored = true) {
  await expect(themeButton(page)).toHaveAccessibleName(themeLabels[language][theme]);
  expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(theme === 'dark');
  await expect(themeButton(page).locator(theme === 'dark' ? '.lucide-sun' : '.lucide-moon')).toHaveCount(1);
  if (stored) expect(await page.evaluate(() => localStorage.getItem('song_theme'))).toBe(theme);
}

async function expectReveal(page: Page, index: number) {
  await expect.poll(() => page.evaluate(() => window.__themeMotion.reveals.length)).toBe(index + 1);
  const rect = await themeButton(page).boundingBox();
  expect(rect).not.toBeNull();
  const origin = { x: rect!.x + rect!.width / 2, y: rect!.y + rect!.height / 2 };
  const result = await page.evaluate(() => ({ motion: window.__themeMotion, width: innerWidth, height: innerHeight }));
  const radius = Math.hypot(Math.max(origin.x, result.width - origin.x), Math.max(origin.y, result.height - origin.y)) + 2;
  const { clipPath, ...timing } = result.motion.reveals[index];
  expect(timing).toEqual({
    duration: 420,
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    fill: 'both',
    pseudoElement: '::view-transition-new(root)',
  });
  for (const [frame, value] of clipPath.entries()) {
    const circle = value.match(/^circle\(([\d.]+)px at ([\d.]+)px ([\d.]+)px\)$/);
    expect(circle).not.toBeNull();
    // Native CSS serialization rounds subpixels; compare geometry rather than spelling.
    expect(Number(circle![1])).toBeCloseTo(frame === 0 ? 0 : radius, 2);
    expect(Number(circle![2])).toBeCloseTo(origin.x, 2);
    expect(Number(circle![3])).toBeCloseTo(origin.y, 2);
  }
  return { ...origin, radius };
}

async function finishReveal(page: Page, count: number) {
  await expect.poll(() => page.evaluate(() => window.__themeMotion.finished)).toBe(count);
  expect(await page.evaluate(() => document.documentElement.classList.contains('theme-transitioning'))).toBe(false);
}

for (const viewport of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 844 }]) {
  for (const language of ['zh', 'en', 'ja'] as const) {
    for (const section of ['', 'work', 'notes', 'about', 'contact', 'theme-test-404']) {
      test(`${viewport.name} ${language}/${section || 'home'} reveals both themes from the button center`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await openPage(page, language, section);
        expect(await page.evaluate(() => window.__themeMotion.calls)).toBe(0);
        await expectTheme(page, 'light', language);
        await themeButton(page).click({ position: { x: 12, y: 23 } });
        await expectReveal(page, 0);
        await finishReveal(page, 1);
        await expectTheme(page, 'dark', language);
        // Keyboard activation must use the same geometric center as an off-center click.
        await themeButton(page).focus();
        await themeButton(page).press('Enter');
        await expectReveal(page, 1);
        await finishReveal(page, 2);
        await expectTheme(page, 'light', language);
        const snapshots = await page.evaluate(() => window.__themeMotion.snapshots);
        expect(snapshots.map(({ dark, stored }) => ({ dark, stored }))).toEqual([
          { dark: true, stored: 'dark' }, { dark: false, stored: 'light' },
        ]);
        expect(snapshots[0].icon).toContain('lucide-sun');
        expect(snapshots[1].icon).toContain('lucide-moon');
      });
    }
  }
}

for (const viewport of [
  { name: 'ultrawide', width: 2560, height: 1080 },
  { name: '16:9', width: 1280, height: 720 },
  { name: '4:3', width: 1024, height: 768 },
  { name: 'landscape phone', width: 844, height: 390 },
  { name: '150% pixel density', width: 960, height: 540 },
]) {
  test(`${viewport.name} computes the reveal in viewport CSS pixels`, async ({ page }) => {
    await page.setViewportSize(viewport);
    if (viewport.name === '150% pixel density') {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: viewport.width, height: viewport.height, deviceScaleFactor: 1.5, mobile: false });
    }
    await openPage(page, 'zh', 'theme-test-404');
    await themeButton(page).click();
    await expectReveal(page, 0);
    await finishReveal(page, 1);
    await expectTheme(page, 'dark');
  });
}

for (const section of ['', 'theme-test-404']) {
  for (const fallback of ['unsupported', 'reduced-motion'] as const) {
    test(`${section || 'home'} ${fallback} switches directly in both directions`, async ({ page }) => {
      if (fallback === 'reduced-motion') await page.emulateMedia({ reducedMotion: 'reduce' });
      else await page.addInitScript(() => { document.startViewTransition = undefined!; });
      await openPage(page, 'zh', section);
      await themeButton(page).click();
      await expectTheme(page, 'dark');
      await themeButton(page).click();
      await expectTheme(page, 'light');
      expect(await page.evaluate(() => window.__themeMotion.calls)).toBe(0);
      expect(await page.evaluate(() => window.__themeMotion.reveals)).toEqual([]);
    });
  }

  test(`${section || 'home'} still switches when localStorage is unavailable`, async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Storage blocked', 'SecurityError'); } });
    });
    await openPage(page, 'zh', section);
    await themeButton(page).click();
    await expectReveal(page, 0);
    await finishReveal(page, 1);
    await expectTheme(page, 'dark', 'zh', false);
    await themeButton(page).click();
    await finishReveal(page, 2);
    await expectTheme(page, 'light', 'zh', false);
  });
}

test('saved dark theme is present on the first rendered frame and reloads without a reveal', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('song_theme', 'dark');
    requestAnimationFrame(() => {
      const sample = () => {
        if (!document.querySelector('.site, .not-found-page')) { requestAnimationFrame(sample); return; }
        document.documentElement.dataset.firstTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
      };
      sample();
    });
  });
  for (const section of ['', 'theme-test-404']) {
    await openPage(page, 'zh', section);
    await expectTheme(page, 'dark');
    await expect(page.locator('html')).toHaveAttribute('data-first-theme', 'dark');
    expect(await page.evaluate(() => window.__themeMotion.calls)).toBe(0);
    await page.reload();
    await expectTheme(page, 'dark');
    expect(await page.evaluate(() => window.__themeMotion.calls)).toBe(0);
  }
});

test('rapid clicks during capture and playback are ignored until completion', async ({ page }) => {
  await openPage(page, 'zh');
  await page.evaluate(() => { window.__pauseThemeReveal = true; });
  await themeButton(page).evaluate(button => { for (let i = 0; i < 8; i++) (button as HTMLButtonElement).click(); });
  await expectReveal(page, 0);
  await themeButton(page).evaluate(button => { for (let i = 0; i < 8; i++) (button as HTMLButtonElement).click(); });
  expect(await page.evaluate(() => window.__themeMotion.calls)).toBe(1);
  await expectTheme(page, 'dark');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).pointerEvents)).toBe('auto');
  await page.evaluate(() => { window.__pauseThemeReveal = false; window.__themeAnimation!.play(); });
  await finishReveal(page, 1);
  await themeButton(page).click();
  await finishReveal(page, 2);
  await expectTheme(page, 'light');
});

async function capture(page: Page, info: TestInfo, name: string) {
  const buffer = await page.screenshot({ path: info.outputPath(`${name}.png`), animations: 'allow' });
  await info.attach(name, { body: buffer, contentType: 'image/png' });
  return buffer.toString('base64');
}

async function pixelSamples(page: Page, png: string, points: { x: number; y: number }[]) {
  return page.evaluate(async ({ png, points }) => {
    const image = new Image();
    image.src = `data:image/png;base64,${png}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(image, 0, 0);
    return points.map(({ x, y }) => Array.from(ctx.getImageData(x, y, 1, 1).data).slice(0, 3));
  }, { png, points });
}

for (const viewport of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 844 }]) {
  for (const section of ['', 'theme-test-404']) {
    test(`${viewport.name} ${section || 'home'} real frames keep new pixels inside the circle and old pixels outside`, async ({ page }, info) => {
      await page.setViewportSize(viewport);
      await openPage(page, 'zh', section);
      await page.evaluate(() => { window.__pauseThemeReveal = true; });
      const points: { x: number; y: number }[] = [];
      const buttonRect = await themeButton(page).boundingBox();
      const buttonX = buttonRect!.x + buttonRect!.width / 2;
      // Desktop 404 places its existing toggle near the middle, so viewport-edge
      // samples alone are all outside the intermediate circle. Sample under it too.
      const columns = [4, viewport.width - 5];
      if (section === 'theme-test-404') columns.push(Math.floor(buttonX - 48), Math.floor(buttonX + 48));
      for (let y = 100; y < viewport.height - 4; y += 40) {
        for (const x of columns) points.push({ x, y });
      }
      const distance = (a: number[], b: number[]) => Math.max(...a.map((channel, i) => Math.abs(channel - b[i])));
      for (const [index, theme] of (['dark', 'light'] as const).entries()) {
        const before = await capture(page, info, `${theme}-before`);
        await themeButton(page).click();
        const origin = await expectReveal(page, index);
        const styles = await page.evaluate(() => {
          const root = document.documentElement;
          return {
            oldOpacity: getComputedStyle(root, '::view-transition-old(root)').opacity,
            newOpacity: getComputedStyle(root, '::view-transition-new(root)').opacity,
            groupAnimation: getComputedStyle(root, '::view-transition-group(root)').animationName,
            oldAnimation: getComputedStyle(root, '::view-transition-old(root)').animationName,
            newAnimation: getComputedStyle(root, '::view-transition-new(root)').animationName,
          };
        });
        expect(styles).toEqual({ oldOpacity: '1', newOpacity: '1', groupAnimation: 'none', oldAnimation: 'none', newAnimation: 'none' });
        const zero = await capture(page, info, `${theme}-0ms`);
        const progress = await page.evaluate(async () => {
          window.__themeAnimation!.currentTime = 126;
          await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
          return window.__themeAnimation!.effect!.getComputedTiming().progress!;
        });
        const middle = await capture(page, info, `${theme}-126ms`);
        await page.evaluate(() => { window.__themeAnimation!.currentTime = 420; });
        const after = await capture(page, info, `${theme}-420ms`);
        const [oldPixels, zeroPixels, midPixels, newPixels] = await Promise.all([
          pixelSamples(page, before, points), pixelSamples(page, zero, points),
          pixelSamples(page, middle, points), pixelSamples(page, after, points),
        ]);
        let inside = 0;
        let outside = 0;
        points.forEach((point, i) => {
          // Use opaque background samples and stay clear of the anti-aliased circle edge.
          if (distance(oldPixels[i], newPixels[i]) < 80) return;
          expect(distance(zeroPixels[i], oldPixels[i])).toBeLessThanOrEqual(8);
          const fromCenter = Math.hypot(point.x - origin.x, point.y - origin.y);
          if (Math.abs(fromCenter - origin.radius * progress) < 5) return;
          const isInside = fromCenter < origin.radius * progress;
          expect(distance(midPixels[i], isInside ? newPixels[i] : oldPixels[i])).toBeLessThanOrEqual(8);
          if (isInside) inside++; else outside++;
        });
        expect(inside).toBeGreaterThan(2);
        expect(outside).toBeGreaterThan(2);
        await page.evaluate(() => window.__themeAnimation!.play());
        await finishReveal(page, index + 1);
        await expectTheme(page, theme);
      }
    });
  }
}
