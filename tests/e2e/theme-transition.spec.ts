import { test, expect, devices, type Page, type TestInfo } from '@playwright/test';
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
    snapshot: { width: number; height: number; offsetX: number; offsetY: number };
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
        const root = document.documentElement;
        const snapshot = getComputedStyle(root, '::view-transition-group(root)');
        const markerStyle = getComputedStyle(root, '::view-transition-group(theme-origin)');
        const marker = document.querySelector('.theme-transition-origin')!.getBoundingClientRect();
        const snapshotTransform = new DOMMatrixReadOnly(snapshot.transform);
        const markerTransform = new DOMMatrixReadOnly(markerStyle.transform);
        window.__themeMotion.reveals.push({
          clipPath: effect.getKeyframes().map(frame => String(frame.clipPath)),
          duration: timing.duration,
          easing: timing.easing,
          fill: timing.fill,
          pseudoElement: options.pseudoElement,
          snapshot: {
            width: parseFloat(snapshot.width), height: parseFloat(snapshot.height),
            offsetX: markerTransform.e - marker.left - snapshotTransform.e,
            offsetY: markerTransform.f - marker.top - snapshotTransform.f,
          },
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
  const result = await page.evaluate(() => window.__themeMotion);
  const { clipPath, snapshot, ...timing } = result.reveals[index];
  const snapshotOrigin = { x: origin.x + snapshot.offsetX, y: origin.y + snapshot.offsetY };
  const radius = Math.hypot(Math.max(snapshotOrigin.x, snapshot.width - snapshotOrigin.x), Math.max(snapshotOrigin.y, snapshot.height - snapshotOrigin.y)) + 2;
  expect(timing).toEqual({
    duration: 520,
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    fill: 'both',
    pseudoElement: '::view-transition-new(root)',
  });
  for (const [frame, value] of clipPath.entries()) {
    const circle = value.match(/^circle\(([\d.]+)px at ([\d.]+)px ([\d.]+)px\)$/);
    expect(circle).not.toBeNull();
    // Native CSS serialization rounds subpixels; compare geometry rather than spelling.
    expect(Number(circle![1])).toBeCloseTo(frame === 0 ? 0 : radius, 2);
    expect(Number(circle![2])).toBeCloseTo(snapshotOrigin.x, 2);
    expect(Number(circle![3])).toBeCloseTo(snapshotOrigin.y, 2);
  }
  return { ...origin, radius };
}

async function finishReveal(page: Page, count: number) {
  await expect.poll(() => page.evaluate(() => window.__themeMotion.finished)).toBe(count);
  expect(await page.evaluate(() => document.documentElement.classList.contains('theme-transitioning'))).toBe(false);
  await expect(page.locator('.theme-transition-origin')).toHaveCount(0);
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

test.describe('mobile snapshot coordinate regression', () => {
  const phone = devices['Pixel 5'];
  test.use({ viewport: phone.viewport, deviceScaleFactor: phone.deviceScaleFactor, userAgent: phone.userAgent, isMobile: true, hasTouch: true });

  for (const scenario of [
    { name: 'no toolbar', top: 0, bottom: 0, scroll: false, section: '' },
    { name: 'top toolbar', top: 56, bottom: 0, scroll: false, section: '' },
    { name: 'bottom toolbar', top: 0, bottom: 56, scroll: false, section: '' },
    { name: 'top and bottom toolbars', top: 56, bottom: 48, scroll: false, section: '' },
    { name: 'partially collapsed toolbar after scrolling', top: 28, bottom: 0, scroll: true, section: '' },
    { name: '404 top toolbar', top: 56, bottom: 0, scroll: false, section: 'theme-test-404' },
  ]) {
    test(`${scenario.name} aligns the circle and joins the final frame without a corner jump`, async ({ page }, info) => {
      await openPage(page, 'zh', scenario.section);
      if (scenario.scroll) {
        await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; scrollTo(0, 600); });
        await expect.poll(() => page.evaluate(() => scrollY)).toBe(600);
        await expect(page.locator('.site-header')).toHaveClass(/scrolled/);
        await page.locator('.site-header').evaluate(header => Promise.all(header.getAnimations().map(animation => animation.finished)));
      }
      // Desktop emulation has no retractable address bar. Recreate its snapshot
      // coordinate space without moving/resizing the actual rendered page image.
      await page.addStyleTag({ content: `
        ::view-transition { top: -${scenario.top}px; bottom: -${scenario.bottom}px; }
        ::view-transition-group(root) { height: calc(100dvh + ${scenario.top + scenario.bottom}px) !important; }
        ::view-transition-old(root), ::view-transition-new(root) {
          height: 100%; object-fit: none; object-position: left ${scenario.top}px;
        }
        ::view-transition-group(theme-origin) { transform: translate(0, ${scenario.top}px) !important; }
      ` });
      const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
      const points = [
        { x: 3, y: 3 }, { x: viewport.width - 4, y: 3 },
        { x: 3, y: viewport.height - 4 }, { x: viewport.width - 4, y: viewport.height - 4 },
      ];
      for (let y = 100; y < viewport.height - 4; y += 32) {
        for (const x of [3, viewport.width - 4]) points.push({ x, y });
      }
      const distance = (a: number[], b: number[]) => Math.max(...a.map((channel, i) => Math.abs(channel - b[i])));
      await page.evaluate(() => { window.__pauseThemeReveal = true; });
      for (const [index, theme] of (['dark', 'light'] as const).entries()) {
        const before = await capture(page, info, `${theme}-before`);
        const button = await themeButton(page).boundingBox();
        // A physical tap avoids the automation's scroll-into-view adjustment on
        // the sticky header, so old/live frame comparisons use the same scroll.
        await page.touchscreen.tap(button!.x + button!.width / 2, button!.y + button!.height / 2);
        if (scenario.scroll) expect(await page.evaluate(() => scrollY)).toBe(600);
        const origin = await expectReveal(page, index);
        const snapshot = await page.evaluate(index => window.__themeMotion.reveals[index].snapshot, index);
        expect(snapshot).toEqual({
          width: viewport.width, height: viewport.height + scenario.top + scenario.bottom,
          offsetX: 0, offsetY: scenario.top,
        });
        const zero = await capture(page, info, `${theme}-0ms`);
        const progress = await page.evaluate(async () => {
          window.__themeAnimation!.currentTime = 156;
          await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
          return window.__themeAnimation!.effect!.getComputedTiming().progress!;
        });
        const middle = await capture(page, info, `${theme}-156ms`);
        await page.evaluate(() => { window.__themeAnimation!.currentTime = 520; });
        const end = await capture(page, info, `${theme}-520ms`);
        await page.evaluate(() => window.__themeAnimation!.play());
        await finishReveal(page, index + 1);
        const settled = await capture(page, info, `${theme}-settled`);
        const [oldPixels, zeroPixels, midPixels, endPixels, settledPixels] = await Promise.all([
          pixelSamples(page, before, points), pixelSamples(page, zero, points),
          pixelSamples(page, middle, points), pixelSamples(page, end, points), pixelSamples(page, settled, points),
        ]);
        let inside = 0, outside = 0;
        points.forEach((point, i) => {
          expect(distance(zeroPixels[i], oldPixels[i])).toBeLessThanOrEqual(8);
          // Includes the bottom-left corner: ending the snapshot must not reveal
          // a differently colored live page underneath it.
          expect(distance(endPixels[i], settledPixels[i])).toBeLessThanOrEqual(8);
          if (distance(oldPixels[i], settledPixels[i]) < 80) return;
          const fromCenter = Math.hypot(point.x - origin.x, point.y - origin.y);
          if (Math.abs(fromCenter - origin.radius * progress) < 5) return;
          const isInside = fromCenter < origin.radius * progress;
          expect(distance(midPixels[i], isInside ? settledPixels[i] : oldPixels[i])).toBeLessThanOrEqual(8);
          if (isInside) inside++; else outside++;
        });
        expect(inside).toBeGreaterThan(1);
        expect(outside).toBeGreaterThan(1);
        await expectTheme(page, theme);
      }
    });
  }
});

for (const viewport of [
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '1600x900', width: 1600, height: 900 },
  { name: '1280x800', width: 1280, height: 800 },
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

for (const section of ['', 'theme-test-404']) {
  test(`${section || 'home'} Space reveals both themes from the same button center`, async ({ page }) => {
    await openPage(page, 'zh', section);
    for (const [index, theme] of (['dark', 'light'] as const).entries()) {
      await themeButton(page).focus();
      await themeButton(page).press('Space');
      await expectReveal(page, index);
      await finishReveal(page, index + 1);
      await expectTheme(page, theme);
    }
  });
}

async function capture(page: Page, info: TestInfo, name: string) {
  const buffer = await page.screenshot({ path: info.outputPath(`${name}.png`), animations: 'allow', scale: 'css' });
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
          window.__themeAnimation!.currentTime = 156;
          await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
          return window.__themeAnimation!.effect!.getComputedTiming().progress!;
        });
        const middle = await capture(page, info, `${theme}-156ms`);
        await page.evaluate(() => { window.__themeAnimation!.currentTime = 520; });
        const after = await capture(page, info, `${theme}-520ms`);
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
