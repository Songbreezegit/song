import { test, expect, type Page } from '@playwright/test';

const base = 'http://127.0.0.1:5175';
const ratios = [[1920, 1080], [1600, 1200], [1500, 1000], [1200, 1200], [1080, 1440], [2100, 900]];

test('covers: existing Work layout and detail navigation remain functional at seven widths', async ({ page }) => {
 await page.goto(base);
 await page.locator('.site-loader').waitFor({ state: 'hidden' });
 await page.getByRole('button', { name: '还有 5 个项目，继续看看' }).click();
 for (const width of [1440, 1280, 1024, 768, 430, 390, 375]) {
  await page.setViewportSize({ width, height: 1000 });
  await page.locator('.project-card').first().scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const cover of await page.locator('#work .project-cover').all()) {
   const box = (await cover.boundingBox())!;
   expect(Math.abs(box.width / box.height - 16 / 9)).toBeLessThan(.01);
  }
 }
 await page.getByRole('button', { name: '查看项目：LizhangApp' }).click();
 await expect(page.getByRole('dialog')).toContainText('LizhangApp');
});

async function setup(page: Page, fixtures = true) {
 const errors: string[] = [];
 page.on('pageerror', error => errors.push(error.message));
 if (fixtures) await page.route('**/cover-fixture/*.svg', route => {
  const index = Number(new URL(route.request().url()).pathname.split('/').pop()!.split('.')[0]);
  const [width, height] = ratios[index];
  return route.fulfill({ contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><linearGradient id="g"><stop stop-color="#adcab1"/><stop offset="1" stop-color="#e7bb9e"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><circle cx="${width / 2}" cy="${height / 2}" r="${Math.min(width, height) / 4}" fill="#f8f6ec"/><text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" font-size="${Math.min(width, height) / 12}" fill="#28463b">${width} × ${height}</text></svg>` });
 });
 await page.goto(base);
 await page.locator('.site-loader').waitFor({ state: 'hidden' });
 // Mount real exported components in an isolated host; no production test route/data.
 await page.evaluate(async () => {
  const { default: React } = await import('/node_modules/.vite/deps/react.js');
  const { default: ReactDOM } = await import('/node_modules/.vite/deps/react-dom_client.js');
  const { ProjectCover } = await import('/src/components/ProjectCover.tsx');
  const { ProjectCard } = await import('/src/components/ProjectCard.tsx');
  document.getElementById('root')!.style.display = 'none';
  const host = document.createElement('div');
  host.id = 'cover-harness';
  host.style.cssText = 'width:calc(100% - 40px);max-width:1240px;margin:20px auto';
  document.body.append(host);
  const root = ReactDOM.createRoot(host);
  Object.assign(window, { renderCovers: (items: Record<string, unknown>[], cards = false) => root.render(React.createElement('div', { className: 'project-grid' }, items.map((props, index) => React.createElement('div', { key: index, className: `project-slot slot-${index % 4}` }, cards ? React.createElement(ProjectCard, { project: props, onSelect: () => {} }) : React.createElement(ProjectCover, props))))) });
 });
 return errors;
}

async function render(page: Page, items: Record<string, unknown>[], cards = false) {
 await page.evaluate(({ items, cards }) => (window as any).renderCovers(items, cards), { items, cards });
 await expect(page.locator('#cover-harness .project-cover')).toHaveCount(items.length);
}

test('covers: six input ratios at seven responsive widths, stable layout and accessible layers', async ({ page }) => {
 const errors = await setup(page);
 await render(page, ratios.map((_, index) => ({ src: `/cover-fixture/${index}.svg`, alt: `Sample ${index}` })));
 for (const width of [1440, 1280, 1024, 768, 430, 390, 375]) {
  await page.setViewportSize({ width, height: 1000 });
  for (const cover of await page.locator('#cover-harness .project-cover').all()) {
   await cover.scrollIntoViewIfNeeded();
   await expect(cover).toHaveAttribute('data-state', 'loaded');
   const box = (await cover.boundingBox())!;
   expect(Math.abs(box.width / box.height - 16 / 9)).toBeLessThan(.01);
   await expect(cover.locator('.project-cover-main')).toHaveCSS('object-fit', 'cover');
   await expect(cover.locator('.project-cover-background')).toHaveAttribute('aria-hidden', 'true');
   await expect(cover.locator('.project-cover-main')).toHaveAttribute('alt', /Sample/);
   const image = (await cover.locator('.project-cover-main').boundingBox())!;
   expect(Math.abs(image.width - box.width)).toBeLessThan(1);
   expect(Math.abs(image.height - box.height)).toBeLessThan(1);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
 }
 expect(errors).toEqual([]);
});

test('covers: loading reserves space, failures recover after source changes, contain and blend API work', async ({ page }) => {
 await setup(page);
 let release!: () => void;
 const pending = new Promise<void>(resolve => { release = resolve; });
 await page.route('**/slow-cover.png', async route => { await pending; await route.abort(); });
 await render(page, [{ src: '/slow-cover.png', alt: 'Recoverable project' }, { src: null, alt: 'No cover' }]);
 const cover = page.locator('#cover-harness .project-cover').first();
 await expect(cover).toHaveAttribute('data-state', 'loading');
 const before = await cover.boundingBox();
 release();
 await expect(cover).toHaveAttribute('data-state', 'fallback');
 expect(await cover.boundingBox()).toEqual(before);
 await expect(cover.locator('img')).toHaveCount(0);
 await expect(cover.getByRole('img')).toHaveAttribute('aria-label', 'Recoverable project：暂无封面');
 await render(page, [{ src: '/cover-fixture/4.svg', alt: 'Recovered', fit: 'contain', position: 'top', blend: 'none' }]);
 await expect(cover).toHaveAttribute('data-state', 'loaded');
 const img = cover.locator('.project-cover-main');
 await expect(img).toHaveCSS('object-fit', 'contain');
 await expect(img).toHaveCSS('object-position', '50% 0%');
 await expect(img).toHaveCSS('mask-image', 'none');
 const box = (await img.boundingBox())!;
 expect(box.width / box.height).toBeCloseTo(1080 / 1440, 2);
 expect(await cover.boundingBox()).toEqual(before);
});

test('covers: card metadata, hover, reduced motion, and shared image URL', async ({ page }) => {
 await setup(page);
 await render(page, [{ id: 'arbitrary-new-project', title: 'New project', categoryLabel: 'Category', description: 'Description', subtitle: 'Never overlay this', coverImage: '/assets/work/work-project-cover-fuji.webp' }], true);
 const cover = page.locator('#cover-harness .project-cover');
 await expect(cover).toHaveAttribute('data-state', 'loaded');
 expect(await cover.textContent()).toBe('');
 expect(await cover.locator('.project-cover-background').getAttribute('src')).toBe(await cover.locator('.project-cover-main').getAttribute('src'));
 await expect(cover.locator('.project-cover-main')).toHaveCSS('mask-composite', /^intersect(?:, intersect)?$/);
 const button = page.locator('#cover-harness .project-link');
 await button.hover();
 await expect(cover).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, -2)');
 await expect(cover.locator('.project-cover-foreground')).toHaveCSS('transform', 'matrix(1.02, 0, 0, 1.02, 0, 0)');
 await expect(button.locator('.project-copy svg')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 3, -3)');
 await page.emulateMedia({ reducedMotion: 'reduce' });
 await expect(cover).toHaveCSS('transform', 'none');
 await expect(cover.locator('.project-cover-foreground')).toHaveCSS('transform', 'none');
});

test('covers: background reuses the loaded resource without a second download', async ({ page }) => {
 await setup(page, false);
 const url = '/assets/work/work-project-cover-fuji.webp?cover-cache-check';
 const requests: string[] = [];
 page.on('request', request => { if (request.url().includes('cover-cache-check')) requests.push(request.url()); });
 await render(page, [{ src: url, alt: 'Cached cover' }]);
 const cover = page.locator('#cover-harness .project-cover');
 await expect(cover).toHaveAttribute('data-state', 'loaded');
 await expect.poll(() => cover.locator('.project-cover-background').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
 expect(requests).toHaveLength(1);
});

test('covers: touch does not depend on hover', async ({ browser }) => {
 const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
 const page = await context.newPage();
 await setup(page);
 await render(page, [{ src: '/cover-fixture/0.svg', alt: 'Touch cover' }]);
 const cover = page.locator('#cover-harness .project-cover');
 await expect(cover).toHaveAttribute('data-state', 'loaded');
 await cover.tap();
 await expect(cover).toHaveCSS('transform', 'none');
 await expect(cover.locator('.project-cover-foreground')).toHaveCSS('transform', 'none');
 await expect(cover).toHaveCSS('border-radius', '22px');
 await context.close();
});

test('covers: optional real cover visual review', async ({ page }, testInfo) => {
 test.skip(!process.env.WORK_COVER_IMAGE, 'Set WORK_COVER_IMAGE to a local real cover for visual review.');
 const errors = await setup(page);
 await page.route('**/real-cover.png', route => route.fulfill({ path: process.env.WORK_COVER_IMAGE!, contentType: 'image/png' }));
 await render(page, [{ src: '/real-cover.png', alt: '礼账 · Lizhang' }, { src: '/cover-fixture/3.svg', alt: 'Square' }, { src: '/cover-fixture/4.svg', alt: 'Portrait' }]);
 for (const width of [1440, 1280, 1024, 768, 430, 390, 375]) {
  await page.setViewportSize({ width, height: 1000 });
  for (const cover of await page.locator('#cover-harness .project-cover').all()) {
   await cover.scrollIntoViewIfNeeded();
   await expect(cover).toHaveAttribute('data-state', 'loaded');
  }
  await page.mouse.move(0, 0);
  await page.waitForTimeout(450);
  await page.locator('#cover-harness').screenshot({ path: testInfo.outputPath(`covers-${width}.png`) });
 }
 expect(errors).toEqual([]);
});
