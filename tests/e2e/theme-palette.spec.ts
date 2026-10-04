import { expect, test, type Page } from '@playwright/test';

const offlineOrigin = 'http://127.0.0.1:5175';
const viewports = [
  { width: 1920, height: 1080 }, { width: 1600, height: 900 },
  { width: 1440, height: 900 }, { width: 1280, height: 800 },
  { width: 390, height: 844 },
];
const layoutSelectors = [
  '.brand', '.header-actions', '.hero-copy', '.hero-person', '.cta',
  '#home', '#work', '#notes', '#about', '#contact', '.site-footer', '.not-found-content',
];

async function layout(page: Page) {
  return page.evaluate(selectors => Object.fromEntries(selectors.map(selector => [selector,
    Array.from(document.querySelectorAll(selector), element => {
      const rect = element.getBoundingClientRect();
      return [rect.x, rect.y + scrollY, rect.width, rect.height].map(value => Math.round(value * 100) / 100);
    }),
  ])), layoutSelectors);
}

async function settle(page: Page) {
  await expect(page.locator('.site-loader')).toHaveCount(0);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.images, image => {
      image.loading = 'eager';
      return image.decode().catch(() => {});
    }));
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
}

for (const viewport of viewports) {
  for (const language of ['zh', 'en', 'ja'] as const) {
    test(`${language} ${viewport.width}x${viewport.height} preserves geometry and renders a readable charcoal palette`, async ({ page }, info) => {
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
      await page.addInitScript(() => {
        sessionStorage.setItem('song-isle-intro', 'seen');
        localStorage.setItem('song_theme', 'light');
      });

      for (const route of ['home', '404']) {
        await page.goto(`${offlineOrigin}/${language}/${route === 'home' ? '' : 'theme-test-404'}`);
        await settle(page);
        const lightLayout = await layout(page);
        const sections = route === 'home' ? ['home', 'work', 'notes', 'about', 'contact', 'footer'] : ['404'];

        for (const theme of ['light', 'dark'] as const) {
          if (theme === 'dark') {
            await page.evaluate(() => window.scrollTo(0, 0));
            await settle(page);
            await page.locator('.header-actions > button.icon-button').first().click();
            await expect(page.locator('html')).toHaveClass(/dark/);
            await settle(page);
            expect(await layout(page)).toEqual(lightLayout);

            const audit = await page.evaluate(() => {
              const rgb = (color: string) => color.match(/[\d.]+/g)!.slice(0, 3).map(Number);
              const luminance = (color: number[]) => color.map(value => {
                const channel = value / 255;
                return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
              }).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
              const contrast = (a: string, b: string) => {
                const values = [luminance(rgb(a)), luminance(rgb(b))].sort((x, y) => y - x);
                return (values[0] + .05) / (values[1] + .05);
              };
              const root = getComputedStyle(document.documentElement);
              const resolveToken = (name: string) => {
                const sample = document.createElement('span');
                sample.style.color = `var(${name})`;
                document.body.append(sample);
                const color = getComputedStyle(sample).color;
                sample.remove();
                return color;
              };
              const sectionColors = ['--bg-page-base', '--bg-home', '--bg-work', '--bg-notes', '--bg-about', '--bg-contact', '--bg-footer'].map(resolveToken);
              const backgrounds = [...sectionColors, resolveToken('--surface-white'), resolveToken('--blue-soft')];
              const primary = getComputedStyle(document.querySelector('.cta')!);
              const secondary = document.querySelector('.cta-secondary');
              const secondaryStyle = secondary ? getComputedStyle(secondary) : null;
              const protectedImages = Array.from(document.querySelectorAll('.hero-person, .hero-person img, .work-illustration > img, .notes-illustration > img, .about-illustration > img, .contact-illustration > img, .floating-badge, .floating-badge img, .brand img, .loader-mark > img:first-child'));
              return {
                overflow: document.documentElement.scrollWidth > innerWidth,
                primaryContrast: contrast(primary.color, primary.backgroundColor),
                primaryLightness: luminance(rgb(primary.backgroundColor)),
                secondaryContrast: secondaryStyle ? contrast(secondaryStyle.color, secondaryStyle.backgroundColor) : null,
                textContrast: backgrounds.map(background => contrast(resolveToken('--muted'), background)),
                headingContrast: sectionColors.map(background => contrast(root.color, background)),
                sectionChroma: sectionColors.map(color => Math.max(...rgb(color)) - Math.min(...rgb(color))),
                sectionLightness: sectionColors.map(color => luminance(rgb(color))),
                globalFilters: Array.from(document.querySelectorAll('html, body, #root, main'), element => getComputedStyle(element).filter),
                imageFilters: protectedImages.map(element => getComputedStyle(element).filter),
                logoMask: getComputedStyle(document.querySelector('.brand')!, '::before').maskImage,
              };
            });
            expect(audit.overflow).toBe(false);
            expect(audit.primaryContrast).toBeGreaterThan(7);
            expect(audit.primaryLightness).toBeGreaterThan(.8);
            expect(audit.primaryLightness).toBeLessThan(.95);
            if (audit.secondaryContrast !== null) expect(audit.secondaryContrast).toBeGreaterThan(7);
            for (const contrast of audit.textContrast) expect(contrast).toBeGreaterThanOrEqual(4.5);
            for (const contrast of audit.headingContrast) expect(contrast).toBeGreaterThan(7);
            for (const chroma of audit.sectionChroma) expect(chroma).toBeLessThanOrEqual(6);
            for (const lightness of audit.sectionLightness) {
              expect(lightness).toBeGreaterThan(.005);
              expect(lightness).toBeLessThan(.02);
            }
            expect(audit.globalFilters.every(filter => filter === 'none')).toBe(true);
            expect(audit.imageFilters.every(filter => filter === 'none')).toBe(true);
            expect(audit.logoMask).toContain('home-logo-wordmark.webp');
            await info.attach(`${route}-palette-audit`, { body: JSON.stringify(audit, null, 2), contentType: 'application/json' });
          }

          for (const section of sections) {
            await page.evaluate(section => {
              const element = document.querySelector<HTMLElement>(section === 'footer' ? '.site-footer' : section === '404' ? '.not-found-page' : `#${section}`)!;
              window.scrollTo(0, section === 'home' || section === '404' ? 0 : element.offsetTop - document.querySelector<HTMLElement>('.site-header')!.offsetHeight);
            }, section);
            await settle(page);
            const screenshot = await page.screenshot({ path: info.outputPath(`${theme}-${section}.png`), animations: 'disabled' });
            await info.attach(`${theme}-${section}`, { body: screenshot, contentType: 'image/png' });
          }
        }
      }
      expect(errors).toEqual([]);
    });
  }
}
