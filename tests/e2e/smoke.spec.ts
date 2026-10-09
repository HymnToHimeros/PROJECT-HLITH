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
    await page.getByRole('navigation', { name: 'Account sections' }).getByRole('link', { name: /^Layout/ }).click();
    await page.getByRole('button', { name: 'Edit layout for ZZZ' }).click();
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

test('the Account page: section bar, a section, browser back, theme', async ({ page }) => {
  await page.goto('/hsr/today');
  await page.getByRole('button', { name: 'Account' }).first().click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Account');
  const bar = page.getByRole('navigation', { name: 'Account sections' });
  for (const s of ['Profile', 'Sync', 'Backup', 'Notifications', 'Game settings', 'Connected accounts', 'Guide', 'Layout', 'Theme']) {
    await expect(bar.getByRole('link', { name: new RegExp(`^${s}`) })).toBeVisible();
  }
  await expect(bar.getByRole('link', { name: 'Owner console' })).toHaveCount(0); // owners only
  await bar.getByRole('link', { name: /^Guide/ }).click();
  await expect(page).toHaveURL(/\/account\/guide$/);
  await expect(page.getByLabel('Setup checklist')).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole('region', { name: 'Your profile' })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/hsr\/today$/);
  await page.goto('/account/theme');
  await page.getByRole('radio', { name: /Light/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await noSidewaysScroll(page);
});

test('Profile: edit name, bio and cards on this device; it survives a reload', async ({ page }) => {
  await page.goto('/account');
  await expect(page.getByRole('region', { name: 'Pulls imported' })).toContainText('No data yet');
  await page.getByRole('button', { name: 'Edit profile' }).click();
  await page.getByLabel('Display name').fill('Mira');
  await page.getByLabel(/^Bio/).fill('Story first, pulls second.');
  await page.getByRole('switch', { name: 'Member since' }).click();
  await noSidewaysScroll(page);
  await page.getByRole('button', { name: 'Save profile' }).click();
  await expect(page.getByRole('heading', { name: 'Mira' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Mira' })).toBeVisible();
  await expect(page.getByText('Story first, pulls second.')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Member since' })).toHaveCount(0);
  await noSidewaysScroll(page);
});

test('the server chip on Today opens Account → Game settings for that game, and back', async ({ page }) => {
  await page.goto('/hsr/today');
  await page.getByRole('button', { name: 'Choose your HSR server' }).click();
  await expect(page).toHaveURL(/\/account\/game-settings\/hsr$/);
  await page.getByRole('radiogroup', { name: 'HSR server' }).getByRole('radio', { name: /Europe/ }).click();
  await page.getByRole('button', { name: 'Done · back to where you were' }).click();
  await expect(page).toHaveURL(/\/hsr\/today$/);
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
