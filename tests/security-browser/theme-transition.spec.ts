import { expect, test } from '@playwright/test';

declare global {
  interface Window {
    __themeCsp: { calls: number; finished: number; reveals: number };
    recordThemeCspViolation: (directive: string) => void;
  }
}

for (const section of ['', 'theme-test-404']) {
  test(`${section || 'home'} circular theme reveal works under the existing production CSP`, async ({ page }, info) => {
    const violations: string[] = [];
    const errors: string[] = [];
    await page.exposeFunction('recordThemeCspViolation', (directive: string) => violations.push(directive));
    page.on('pageerror', error => errors.push(error.message));
    // All content requests stay inside local browser fixtures.
    await page.route('https://backend-v1-test.supabase.co/rest/v1/**', route => route.fulfill({ contentType: 'application/json', body: '[]' }));
    await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
    await page.addInitScript(() => {
      sessionStorage.setItem('song-isle-intro', 'seen');
      window.__themeCsp = { calls: 0, finished: 0, reveals: 0 };
      document.addEventListener('securitypolicyviolation', event => window.recordThemeCspViolation(event.effectiveDirective));
      const start = document.startViewTransition.bind(document);
      document.startViewTransition = (options) => {
        window.__themeCsp.calls++;
        const transition = start(options);
        void transition.finished.then(() => window.__themeCsp.finished++, () => window.__themeCsp.finished++);
        return transition;
      };
      const animate = Element.prototype.animate;
      Element.prototype.animate = function (frames, options) {
        if (options && typeof options !== 'number' && options.pseudoElement === '::view-transition-new(root)') window.__themeCsp.reveals++;
        return animate.call(this, frames, options);
      };
    });

    const response = await page.goto(`/zh/${section}`);
    expect(response!.headers()[info.project.name === 'enforced' ? 'content-security-policy' : 'content-security-policy-report-only']).toContain("script-src 'self'");
    const toggle = page.locator('.header-actions > button.icon-button').first();
    await expect(toggle).toBeVisible();
    await expect(page.locator('.site-loader')).toHaveCount(0);
    for (const [index, theme] of (['dark', 'light'] as const).entries()) {
      await toggle.click();
      await expect.poll(() => page.evaluate(() => window.__themeCsp.finished)).toBe(index + 1);
      expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(theme === 'dark');
      expect(await page.evaluate(() => localStorage.getItem('song_theme'))).toBe(theme);
    }
    expect(await page.evaluate(() => window.__themeCsp)).toEqual({ calls: 2, finished: 2, reveals: 2 });
    expect(violations).toEqual([]);
    expect(errors).toEqual([]);
  });
}
