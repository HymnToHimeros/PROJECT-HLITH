import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// R62: one import and one scan button in All games, one list of HoYoLAB accounts,
// with no serious accessibility problems and no sideways scroll at PC and phone sizes.
const axeProblems = async (page: Page, where: string) => {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return result.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${where}: ${v.id} (${v.nodes.length}) ${v.help} → ${v.nodes[0]?.target.join(' ')}`);
};
const noSidewaysScroll = async (page: Page) => {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
};

test('All games roster: one Import from HoYoLAB and one Scan a screenshot, each with a game picker', async ({ page }) => {
  await page.goto('/all/roster');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Import from HoYoLAB' })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Scan a screenshot' })).toHaveCount(1);

  await page.getByRole('button', { name: 'Import from HoYoLAB' }).click();
  const sheet = page.getByRole('dialog', { name: 'Import from HoYoLAB' });
  await expect(sheet.getByRole('tablist', { name: 'Which game to import' })).toContainText('Every connected game');
  await expect(sheet.getByRole('region', { name: 'Example preview' })).toBeVisible();
  const problems = await axeProblems(page, 'import sheet');
  await noSidewaysScroll(page);
  await sheet.getByRole('button', { name: 'Close' }).click();

  await page.getByRole('button', { name: 'Scan a screenshot' }).click();
  const scan = page.getByRole('dialog', { name: 'Scan a screenshot' });
  await expect(scan.getByRole('tablist', { name: 'Which game is the screenshot from' })).toBeVisible();
  problems.push(...(await axeProblems(page, 'scan sheet')));
  expect(problems, problems.join('\n')).toEqual([]);
});

test('Connected accounts: one list, explained, honest about what needs you', async ({ page }) => {
  await page.goto('/all/today');
  await page.getByRole('button', { name: 'Account' }).first().click();
  const sheet = page.getByRole('dialog', { name: 'Account' });
  await sheet.getByRole('button', { name: /^Connected accounts/ }).click();
  await expect(sheet.getByText('How connected accounts work')).toBeVisible();
  await expect(sheet.getByLabel('Example accounts')).toContainText('EXAMPLE');
  await expect(sheet.getByRole('region', { name: 'What HLITH can do on its own' })).toContainText('Web events need you to open them yourself');
  await expect(sheet.getByRole('region', { name: 'Add a HoYoLAB account' })).toHaveCount(1);
  const problems = await axeProblems(page, 'connected accounts');
  expect(problems, problems.join('\n')).toEqual([]);
  await noSidewaysScroll(page);
});
