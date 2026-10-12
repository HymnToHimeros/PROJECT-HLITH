import { expect, test } from '@playwright/test';

// Installable app (T45): the built site has a manifest and icons, registers its service worker,
// passes Chrome's own installability check, and opens offline with a note saying so.

test('the manifest and icons are served and complete', async ({ page, request }) => {
  await page.goto('/');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBe('/hlith.webmanifest');
  const manifest = await (await request.get(href as string)).json();
  expect(manifest).toMatchObject({ name: 'HLIÐSKJÁLF', short_name: 'HLITH', start_url: '/', scope: '/', display: 'standalone' });
  const purposes = (manifest.icons as { src: string; sizes: string; purpose: string }[]).map((i) => `${i.sizes} ${i.purpose}`);
  expect(purposes).toEqual(expect.arrayContaining(['192x192 any', '512x512 any', '192x192 maskable', '512x512 maskable']));
  for (const icon of manifest.icons as { src: string }[]) {
    const res = await request.get(icon.src);
    expect(res.ok(), icon.src).toBe(true);
    expect(res.headers()['content-type']).toContain('image/png');
  }
  expect((await request.get((await page.locator('link[rel="apple-touch-icon"]').getAttribute('href')) as string)).ok()).toBe(true);
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
});

test('Chrome sees it as installable, and it opens offline', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  // The worker is running and controls the page.
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  const cdp = await context.newCDPSession(page);
  const { installabilityErrors } = (await cdp.send('Page.getInstallabilityErrors')) as { installabilityErrors: { errorId: string }[] };
  // "in-incognito" is about the test browser (a private window), not the site.
  expect(installabilityErrors.map((e) => e.errorId).filter((id) => id !== 'in-incognito')).toEqual([]);

  // Offline: a different address still opens the app, and it says it's offline. The browser's
  // own online flag isn't trusted (some browsers keep it true): pin it to true so the app has
  // to find out for itself, as it must on a real phone.
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'onLine', { get: () => true }));
  await context.setOffline(true);
  await page.goto('/hsr/roster');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Roster');
  await expect(page.getByRole('status', { name: 'Offline' })).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByRole('status', { name: 'Offline' })).toBeHidden({ timeout: 15_000 });
});

test('Account → Guide shows how to install while it isn’t installed', async ({ page }) => {
  await page.goto('/account/guide');
  const card = page.getByRole('region', { name: 'Install HLITH as an app' });
  await expect(card).toBeVisible();
  await expect(card).toContainText(/Add to Home Screen|Install app|Install HLIÐSKJÁLF/);
});
