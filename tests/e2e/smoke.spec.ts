import { expect, test } from '@playwright/test';

test('the app opens and shows its name', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/PROJECT-HLITH/);
  await expect(page.getByRole('heading', { name: 'HLIÐSKJÁLF' })).toBeVisible();
});

test('the component preview renders every section', async ({ page }) => {
  await page.goto('/preview');
  await expect(page.getByText('PROJECT-HLITH · LAYER 4 PREVIEW')).toBeVisible();
  await expect(page.getByText('No pull history yet')).toBeVisible();
  await page.getByRole('button', { name: 'Open the More sheet' }).click();
  await expect(page.getByRole('dialog', { name: 'More' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // No sideways scrolling on any screen size.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
