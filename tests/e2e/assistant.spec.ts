import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// R46, R48, R49: the Assistant panel (chat, settings, proposals) and Edit mode
// have no serious or critical accessibility problems at PC and phone sizes,
// and Edit mode keeps what you add.

const openAssistant = async (page: Page, isMobile: boolean) => {
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible(); // app ready
  if (isMobile) await page.getByRole('button', { name: 'Assistant', exact: true }).click();
  else await page.keyboard.press('Control+k');
  const dialog = page.getByRole('dialog', { name: 'Assistant' });
  await expect(dialog).toBeVisible();
  return dialog;
};

const serious = async (page: Page, where: string) => {
  const result = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return result.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${where}: ${v.id} (${v.nodes.length}) ${v.help} → ${v.nodes[0]?.target.join(' ')}`);
};

test('Assistant panel and Edit mode: no serious accessibility problems', async ({ page, isMobile }) => {
  const problems: string[] = [];
  await page.goto('/hsr/today');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  let dialog = await openAssistant(page, isMobile);
  await expect(dialog.getByRole('region', { name: 'Example conversation' })).toBeVisible();
  // Browser tests run without the server: said first, and no key asked for in the chat.
  await expect(dialog.getByText(/isn’t connected to its server/)).toBeVisible();
  await expect(dialog.getByRole('region', { name: 'Add your Claude API key' })).toHaveCount(0);
  problems.push(...(await serious(page, 'chat, no server')));

  // A key can still be saved in Settings (on this device only).
  await dialog.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(dialog.getByText('WHICH MODEL ANSWERS')).toBeVisible();
  await dialog.getByRole('textbox', { name: 'Claude API key' }).fill('sk-ant-api03-E2E_TEST_KEY_not_real_000000');
  await dialog.getByRole('button', { name: 'Save key' }).click();
  await expect(dialog.getByText('YOUR CLAUDE KEY')).toBeVisible();
  problems.push(...(await serious(page, 'settings')));

  await dialog.getByRole('button', { name: 'Edit lists', exact: true }).click();
  await dialog.getByRole('tab', { name: 'Backlog' }).click();
  await dialog.getByRole('button', { name: 'Add backlog item' }).click();
  // The same form as on the Backlog screen.
  const form = dialog.getByRole('form', { name: 'Add a backlog item' });
  problems.push(...(await serious(page, 'edit mode form')));
  await form.getByLabel('Name').fill('My own side quest chain');
  await form.getByLabel('Category').selectOption('side-quests');
  await form.getByRole('radio', { name: /Counter/ }).check();
  await form.getByLabel('How much there is in total').fill('8');
  await form.getByRole('button', { name: 'Add item' }).click();
  await expect(dialog.getByText('My own side quest chain')).toBeVisible();
  problems.push(...(await serious(page, 'edit mode list')));

  expect(problems, problems.join('\n')).toEqual([]);

  // Kept on this device after a reload; the key too (until "Forget key").
  await page.reload();
  dialog = await openAssistant(page, isMobile);
  await dialog.getByRole('button', { name: 'Edit lists', exact: true }).click();
  await dialog.getByRole('tab', { name: 'Backlog' }).click();
  await expect(dialog.getByText('My own side quest chain')).toBeVisible();
  await dialog.getByRole('button', { name: 'Settings', exact: true }).click();
  await dialog.getByRole('button', { name: 'Forget key' }).click();
  expect(await page.evaluate(() => localStorage.getItem('hlith.assistant.key'))).toBeNull();
});
