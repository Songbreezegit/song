import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { fixture, login } from './fixtures/backend';

type AdminThemeMotion = {
  calls: number; finished: number;
  snapshots: { dark: boolean; stored: string | null; pressed: string | null }[];
  reveals: { clipPath: string[]; duration: number | string; easing: string; fill: string; width: number; height: number; offsetX: number; offsetY: number }[];
};
declare global {
  interface Window {
    __adminThemeMotion: AdminThemeMotion;
    __adminThemeAnimation?: Animation;
    __pauseAdminThemeReveal?: boolean;
  }
}
const button = (page: Page) => page.locator('.admin-theme-toggle:visible');
const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const messages: string[] = []; errors.set(page, messages);
  page.on('pageerror', error => messages.push(error.message));
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
  await page.addInitScript(() => {
    window.__adminThemeMotion = { calls: 0, finished: 0, snapshots: [], reveals: [] };
    const start = document.startViewTransition?.bind(document);
    if (start) document.startViewTransition = options => {
      window.__adminThemeMotion.calls++;
      const update = typeof options === 'function' ? options : options?.update;
      const transition = start(() => {
        const result = update?.();
        window.__adminThemeMotion.snapshots.push({ dark: document.documentElement.classList.contains('dark'), stored: localStorage.getItem('song_theme'), pressed: document.querySelector('.admin-theme-toggle')?.getAttribute('aria-pressed') ?? null });
        return result;
      });
      void transition.finished.then(() => window.__adminThemeMotion.finished++, () => window.__adminThemeMotion.finished++);
      return transition;
    };
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (keyframes, options) {
      const animation = animate.call(this, keyframes, options);
      if (options && typeof options !== 'number' && options.pseudoElement === '::view-transition-new(root)') {
        const effect = animation.effect as KeyframeEffect;
        const timing = effect.getTiming();
        const group = getComputedStyle(document.documentElement, '::view-transition-group(root)');
        const markerStyle = getComputedStyle(document.documentElement, '::view-transition-group(theme-origin)');
        const marker = document.querySelector('.theme-transition-origin')!.getBoundingClientRect();
        const groupTransform = new DOMMatrixReadOnly(group.transform);
        const markerTransform = new DOMMatrixReadOnly(markerStyle.transform);
        window.__adminThemeMotion.reveals.push({ clipPath: effect.getKeyframes().map(frame => String(frame.clipPath)),
          duration: timing.duration, easing: timing.easing, fill: timing.fill,
          width: parseFloat(group.width), height: parseFloat(group.height),
          offsetX: markerTransform.e - marker.left - groupTransform.e, offsetY: markerTransform.f - marker.top - groupTransform.f });
        window.__adminThemeAnimation = animation;
        if (window.__pauseAdminThemeReveal) { animation.pause(); animation.currentTime = 0; }
      }
      return animation;
    };
  });
});
test.afterEach(({ page }) => { expect(errors.get(page)).toEqual([]); });

async function openAdmin(page: Page, path: string) {
  await fixture(page);
  if (path !== 'login') { await login(page); await expect(page).toHaveURL(/dashboard$/); }
  await page.goto(`/admin/${path}`);
  await expect(button(page)).toBeVisible();
  await expect(page.locator('.admin-loading-content')).toHaveCount(0);
  await page.evaluate(async () => { await document.fonts.ready; });
}

async function expectTheme(page: Page, theme: 'light' | 'dark') {
  await expect(button(page)).toHaveAccessibleName(theme === 'dark' ? '切换到浅色模式' : '切换到深色模式');
  await expect(button(page)).toHaveAttribute('aria-pressed', String(theme === 'dark'));
  expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(theme === 'dark');
  expect(await page.evaluate(() => localStorage.getItem('song_theme'))).toBe(theme);
}

async function revealGeometry(page: Page, index: number) {
  await expect.poll(() => page.evaluate(() => window.__adminThemeMotion.reveals.length)).toBe(index + 1);
  const rect = (await button(page).boundingBox())!;
  const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  const reveal = await page.evaluate(index => window.__adminThemeMotion.reveals[index], index);
  const origin = { x: center.x + reveal.offsetX, y: center.y + reveal.offsetY };
  const radius = Math.hypot(Math.max(origin.x, reveal.width - origin.x), Math.max(origin.y, reveal.height - origin.y)) + 2;
  expect({ duration: reveal.duration, easing: reveal.easing, fill: reveal.fill }).toEqual({ duration: 520, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'both' });
  reveal.clipPath.forEach((clip, frame) => {
    const circle = clip.match(/^circle\(([\d.]+)px at ([\d.]+)px ([\d.]+)px\)$/);
    expect(circle).not.toBeNull();
    expect(Number(circle![1])).toBeCloseTo(frame === 0 ? 0 : radius, 2);
    expect(Number(circle![2])).toBeCloseTo(origin.x, 2); expect(Number(circle![3])).toBeCloseTo(origin.y, 2);
  });
  return { ...center, radius };
}

async function finish(page: Page, count: number) {
  await expect.poll(() => page.evaluate(() => window.__adminThemeMotion.finished)).toBe(count);
  await expect(page.locator('.theme-transition-origin')).toHaveCount(0);
  await expect(page.locator('html')).not.toHaveClass(/theme-transitioning/);
}
async function capture(page: Page, info: TestInfo, name: string) {
  const png = await page.screenshot({ path: info.outputPath(`${name}.png`), animations: 'allow', scale: 'css' });
  await info.attach(name, { body: png, contentType: 'image/png' });
  return png.toString('base64');
}
async function pixels(page: Page, png: string, points: { x: number; y: number }[]) {
  return page.evaluate(async ({ png, points }) => {
    const image = new Image(); image.src = `data:image/png;base64,${png}`; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d')!; context.drawImage(image, 0, 0);
    return points.map(({ x, y }) => Array.from(context.getImageData(x, y, 1, 1).data).slice(0, 3));
  }, { png, points });
}

for (const viewport of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 844 }]) {
  for (const path of ['login', 'dashboard', 'projects', 'articles', 'site', 'media', 'projects/new', 'articles/new']) {
    test(`${viewport.name} ${path} renders actual circular theme frames from mouse and keyboard centers`, async ({ page }, info) => {
      await page.setViewportSize(viewport);
      await openAdmin(page, path);
      await page.evaluate(() => { window.__pauseAdminThemeReveal = true; });
      const points: { x: number; y: number }[] = [];
      for (let y = 110; y < viewport.height - 4; y += 40) {
        for (const x of [4, Math.floor(viewport.width / 4), Math.floor(viewport.width / 2), Math.floor(viewport.width * 3 / 4), viewport.width - 5]) points.push({ x, y });
      }
      const distance = (left: number[], right: number[]) => Math.max(...left.map((channel, i) => Math.abs(channel - right[i])));
      for (const [index, theme] of (['dark', 'light'] as const).entries()) {
        // Login auto-focuses its email field. Settle that ordinary focus border
        // before comparing theme snapshots, so a click's blur is not a color bug.
        await button(page).focus();
        await page.locator('.admin-theme-root').evaluate(async root => {
          void getComputedStyle(root).color;
          await Promise.all(root.getAnimations({ subtree: true }).map(animation => animation.finished));
        });
        const before = await capture(page, info, `${theme}-before`);
        if (index === 0) await button(page).click({ position: { x: 6, y: 8 } });
        else await button(page).press(path === 'login' ? 'Space' : 'Enter');
        const origin = await revealGeometry(page, index);
        const styles = await page.evaluate(() => ({
          oldOpacity: getComputedStyle(document.documentElement, '::view-transition-old(root)').opacity,
          newOpacity: getComputedStyle(document.documentElement, '::view-transition-new(root)').opacity,
          animation: getComputedStyle(document.documentElement, '::view-transition-group(root)').animationName,
        }));
        expect(styles).toEqual({ oldOpacity: '1', newOpacity: '1', animation: 'none' });
        const zero = await capture(page, info, `${theme}-0ms`);
        const progress = await page.evaluate(async () => {
          window.__adminThemeAnimation!.currentTime = 156;
          await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
          return window.__adminThemeAnimation!.effect!.getComputedTiming().progress!;
        });
        const middle = await capture(page, info, `${theme}-156ms`);
        await page.evaluate(() => { window.__adminThemeAnimation!.currentTime = 520; });
        const end = await capture(page, info, `${theme}-520ms`);
        const [oldPixels, zeroPixels, midPixels, endPixels] = await Promise.all([pixels(page, before, points), pixels(page, zero, points), pixels(page, middle, points), pixels(page, end, points)]);
        let inside = 0, outside = 0;
        points.forEach((point, i) => {
          if (distance(oldPixels[i], endPixels[i]) < 80) return;
          expect(distance(zeroPixels[i], oldPixels[i]), JSON.stringify({ theme, point, old: oldPixels[i], zero: zeroPixels[i] })).toBeLessThanOrEqual(8);
          const fromCenter = Math.hypot(point.x - origin.x, point.y - origin.y);
          if (Math.abs(fromCenter - origin.radius * progress) < 5) return;
          const covered = fromCenter < origin.radius * progress;
          expect(distance(midPixels[i], covered ? endPixels[i] : oldPixels[i]), JSON.stringify({ theme, point, covered, progress, origin, actual: midPixels[i], expected: covered ? endPixels[i] : oldPixels[i] })).toBeLessThanOrEqual(8);
          if (covered) inside++; else outside++;
        });
        expect(inside).toBeGreaterThan(2); expect(outside).toBeGreaterThan(2);
        await page.evaluate(() => window.__adminThemeAnimation!.play()); await finish(page, index + 1);
        await expectTheme(page, theme);
        if (index === 1) await expect(button(page)).toBeFocused();
      }
      expect((await page.evaluate(() => window.__adminThemeMotion.snapshots))).toEqual([
        { dark: true, stored: 'dark', pressed: 'true' }, { dark: false, stored: 'light', pressed: 'false' },
      ]);
    });
  }
}

for (const path of ['login', 'dashboard']) {
  for (const fallback of ['unsupported', 'reduced-motion']) {
    test(`${path} ${fallback} changes theme directly and retains keyboard focus`, async ({ page }) => {
      if (fallback === 'unsupported') await page.addInitScript(() => { document.startViewTransition = undefined!; });
      else await page.emulateMedia({ reducedMotion: 'reduce' });
      await openAdmin(page, path);
      for (const theme of ['dark', 'light'] as const) {
        await button(page).focus(); await button(page).press('Space');
        await expectTheme(page, theme); await expect(button(page)).toBeFocused();
      }
      expect(await page.evaluate(() => window.__adminThemeMotion.calls)).toBe(0);
    });
  }
}

test('mobile theme focus and drawer focus remain independent, and saved appearance survives reload', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAdmin(page, 'dashboard');
  await button(page).focus(); await button(page).press('Enter');
  await finish(page, 1); await expectTheme(page, 'dark'); await expect(button(page)).toBeFocused();
  await page.getByRole('button', { name: '切换菜单', exact: true }).click();
  await expect(page.locator('.admin-topbar')).toHaveAttribute('inert');
  await expect(page.locator('#admin-sidebar .admin-sidebar-brand a')).toBeFocused();
  // Playwright's role locator computes its own accessibility tree and includes
  // inert descendants. Check Chromium's actual accessibility node instead.
  const cdp = await page.context().newCDPSession(page);
  const { root } = await cdp.send('DOM.getDocument');
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '.admin-theme-toggle' });
  const { nodes } = await cdp.send('Accessibility.getPartialAXTree', { nodeId, fetchRelatives: false });
  expect(nodes[0]!.ignored).toBe(true);
  await cdp.detach();
  await page.locator('.admin-theme-toggle').evaluate(element => (element as HTMLButtonElement).focus());
  await expect(page.locator('#admin-sidebar .admin-sidebar-brand a')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: '切换菜单', exact: true })).toBeFocused();
  await expect(page.locator('.admin-topbar')).not.toHaveAttribute('inert');
  await button(page).focus(); await button(page).press('Space'); await finish(page, 2); await expectTheme(page, 'light');
  await button(page).press('Enter'); await finish(page, 3); await expectTheme(page, 'dark');
  await page.reload(); await expectTheme(page, 'dark');
  expect(await page.evaluate(() => window.__adminThemeMotion.calls)).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
