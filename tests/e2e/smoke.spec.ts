import { expect, test } from '@playwright/test';

const noSidewaysScroll = async (page: import('@playwright/test').Page) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
};

test('the app opens on All games, Today', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/PROJECT-HLITH/);
  await expect(page).toHaveURL(/\/all\/today$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Today');
  await noSidewaysScroll(page);
});

test('switch game, open a module, edit the layout', async ({ page, isMobile }) => {
  await page.goto('/');
  if (isMobile) {
    await page.getByRole('group', { name: 'Game' }).getByRole('button', { name: 'ZZZ' }).click();
    await page.getByRole('navigation', { name: 'Modules (phone)' }).getByRole('button', { name: /More/ }).click();
    await page.getByRole('dialog', { name: 'More' }).getByRole('link', { name: 'Farm' }).click();
  } else {
    await page.getByRole('button', { name: 'ZZZ' }).click();
    await page.getByRole('navigation', { name: 'Modules' }).getByRole('link', { name: /Farm/ }).click();
  }
  await expect(page).toHaveURL(/\/zzz\/farm$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Farm');

  // Edit layout: hide Intel, it survives a reload (saved on this device).
  if (isMobile) {
    await page.getByRole('button', { name: 'Account' }).click();
    await page.getByRole('dialog', { name: 'Account' }).getByRole('button', { name: /Layout settings/ }).click();
  } else {
    await page.getByRole('button', { name: 'Edit layout' }).click();
  }
  const edit = page.getByRole('dialog', { name: /Edit layout/ });
  await expect(edit.getByText('PHONE BAR ↑ · MORE ↓')).toBeVisible();
  const intelRow = edit.locator('[data-row]', { hasText: 'Intel' });
  await intelRow.getByRole('button', { name: 'Hide' }).click();
  await expect(edit.getByText('HIDDEN · STILL IN THIS GAME')).toBeVisible();
  await page.reload();
  if (!isMobile) await expect(page.getByRole('navigation', { name: 'Modules' }).getByRole('link', { name: /Intel/ })).toHaveCount(0);
  await noSidewaysScroll(page);
});

test('drag a module to the top of the list (PC)', async ({ page, isMobile }) => {
  test.skip(isMobile, 'pointer drag is covered on PC; phone uses the same handler');
  await page.goto('/hsr/today');
  await page.getByRole('button', { name: 'Edit layout' }).click();
  const handle = page.getByRole('button', { name: 'Move Calendar' });
  const top = page.getByRole('button', { name: 'Move Today' });
  const from = await handle.boundingBox();
  const to = await top.boundingBox();
  if (!from || !to) throw new Error('rows not laid out');
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + 2, { steps: 8 });
  await page.mouse.up();
  const first = page.getByRole('navigation', { name: 'Modules' }).getByRole('link').first();
  await expect(first).toContainText('Calendar');
});

test('the Account sheet: rows as designed, a sub-page, and back', async ({ page }) => {
  await page.goto('/hsr/today');
  await page.getByRole('button', { name: 'Account' }).first().click();
  const sheet = page.getByRole('dialog', { name: 'Account' });
  for (const row of ['Sync', 'Backup', 'Notifications', 'Game settings', 'Guide', 'Layout settings', 'Theme']) {
    await expect(sheet.getByRole('button', { name: new RegExp(`^${row}`) })).toBeVisible();
  }
  await sheet.getByRole('button', { name: /^Guide/ }).click();
  await expect(sheet.getByLabel('Setup checklist')).toBeVisible();
  await sheet.getByRole('button', { name: 'Back to Account' }).click();
  await sheet.getByRole('button', { name: /^Theme/ }).click();
  await sheet.getByRole('radio', { name: /Light/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await noSidewaysScroll(page);
});

test('the server chip on Today opens the server picker', async ({ page }) => {
  await page.goto('/hsr/today');
  await page.getByRole('button', { name: 'Choose your HSR server' }).click();
  const sheet = page.getByRole('dialog', { name: /Server · Honkai: Star Rail/ });
  await sheet.getByRole('radio', { name: /Europe/ }).click();
  await expect(page.getByRole('button', { name: 'HSR server: Europe. Change' })).toBeVisible();
});

test('the component preview renders every section', async ({ page }) => {
  await page.goto('/preview');
  await expect(page.getByText('PROJECT-HLITH · LAYER 4 PREVIEW')).toBeVisible();
  await page.getByRole('button', { name: 'Open the More sheet' }).click();
  await expect(page.getByRole('dialog', { name: 'More' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await noSidewaysScroll(page);
});

test('every module opens a real screen in every game, with no errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const scope of ['all', 'hsr', 'zzz']) {
    for (const module of ['today', 'pulls', 'roster', 'calendar', 'events', 'banners', 'backlog', 'farm', 'intel']) {
      await page.goto(`/${scope}/${module}`);
      await expect(page.getByText('BEING BUILT')).toHaveCount(0);
      await expect(page.getByText('Loading…')).toHaveCount(0);
      await noSidewaysScroll(page);
    }
  }
  expect(errors).toEqual([]);
});
