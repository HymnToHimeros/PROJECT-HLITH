import { expect, test, type Page, type Request } from '@playwright/test';

// Account → Example data: switching examples off hides every example on every screen
// (empty places say "No data yet"), and switching them on brings them back.
const PAGES = [
  'today',
  'pulls/planner',
  'pulls/calculator',
  'pulls/log',
  'pulls/history',
  'roster/characters',
  'roster/teams',
  'calendar',
  'events',
  'banners',
  'backlog',
  'farm',
  'intel',
];

// Waits for the screen to stop loading. If it doesn't within 30 s, fails naming the screen and
// the requests still open, so a stuck request says what it is instead of running out the test's time.
function quietWatcher(page: Page) {
  const open = new Set<Request>();
  page.on('request', (r) => open.add(r));
  page.on('requestfinished', (r) => open.delete(r));
  page.on('requestfailed', (r) => open.delete(r));
  return async () => {
    try {
      await page.waitForLoadState('networkidle', { timeout: 30_000 });
    } catch {
      throw new Error(`${page.url()} never stopped loading; still open:\n${[...open].map((r) => `${r.method()} ${r.url()}`).join('\n') || '(none seen)'}`);
    }
  };
}

test('Example data off hides every example; on brings them back', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const quiet = quietWatcher(page);

  await page.goto('/account/examples');
  const toggle = page.getByRole('switch', { name: 'Show example data' });
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  await expect(toggle).not.toBeChecked();

  const leftovers: string[] = [];
  for (const scope of ['all', 'hsr', 'zzz']) {
    for (const p of PAGES) {
      await page.goto(`/${scope}/${p}`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByText('Loading…')).toHaveCount(0);
      await quiet();
      const n = await page.getByText('EXAMPLE', { exact: true }).count();
      if (n > 0) leftovers.push(`/${scope}/${p}: ${n}`);
    }
  }
  expect(leftovers, leftovers.join('\n')).toEqual([]);
  expect(errors, errors.join('\n')).toEqual([]);

  await page.goto('/account/examples');
  await page.getByRole('switch', { name: 'Show example data' }).check();
  // Real lists replace examples where they exist (events, banners…), so look for any screen that still shows one.
  const shown: string[] = [];
  for (const p of PAGES) {
    await page.goto(`/hsr/${p}`);
    await expect(page.getByText('Loading…')).toHaveCount(0);
    await quiet();
    if ((await page.getByText('EXAMPLE', { exact: true }).count()) > 0) shown.push(p);
  }
  expect(shown.length, 'no screen shows an example after switching them back on').toBeGreaterThan(0);
});
