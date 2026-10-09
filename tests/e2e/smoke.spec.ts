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
    await page.getByRole('button', { name: /Change game/ }).click();
    await page.getByRole('dialog', { name: 'Game' }).getByRole('button', { name: 'ZZZ' }).click();
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
    await page.getByRole('dialog', { name: 'Account' }).getByRole('button', { name: /Edit layout/ }).click();
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

test('the component preview renders every section', async ({ page }) => {
  await page.goto('/preview');
  await expect(page.getByText('PROJECT-HLITH · LAYER 4 PREVIEW')).toBeVisible();
  await page.getByRole('button', { name: 'Open the More sheet' }).click();
  await expect(page.getByRole('dialog', { name: 'More' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await noSidewaysScroll(page);
});
