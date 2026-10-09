import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// R59: every module, in every game scope, has no serious or critical accessibility
// problems (labels, contrast, roles, keyboard) at PC and phone sizes.
const MODULES = ['today', 'pulls', 'roster', 'calendar', 'events', 'banners', 'backlog', 'farm', 'intel'];

for (const scope of ['all', 'hsr', 'zzz']) {
  test(`no serious accessibility problems · ${scope}`, async ({ page }) => {
    test.setTimeout(180_000); // nine full scans per game scope
    const problems: string[] = [];
    for (const module of MODULES) {
      await page.goto(`/${scope}/${module}`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      // Scan the finished screen, not a half-loaded one.
      await expect(page.getByText('Loading…')).toHaveCount(0);
      await page.waitForLoadState('networkidle');
      const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      for (const v of result.violations) {
        if (v.impact === 'serious' || v.impact === 'critical') problems.push(`/${scope}/${module}: ${v.id} (${v.nodes.length}) ${v.help} → ${v.nodes[0]?.target.join(' ')}`);
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });
}

// The Account page (/account/<section>): every section, plus Profile in edit mode.
const ACCOUNT_SECTIONS = ['', 'sync', 'backup', 'notifications', 'game-settings', 'connections', 'guide', 'layout', 'theme', 'sign-in'];

test('no serious accessibility problems · account', async ({ page }) => {
  test.setTimeout(180_000);
  const problems: string[] = [];
  const scan = async (where: string) => {
    await expect(page.getByText('Loading…')).toHaveCount(0);
    await page.waitForLoadState('networkidle');
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    for (const v of result.violations) {
      if (v.impact === 'serious' || v.impact === 'critical') problems.push(`${where}: ${v.id} (${v.nodes.length}) ${v.help} → ${v.nodes[0]?.target.join(' ')}`);
    }
  };
  for (const section of ACCOUNT_SECTIONS) {
    const path = section ? `/account/${section}` : '/account';
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Account');
    await scan(path);
  }
  await page.goto('/account');
  await page.getByRole('button', { name: 'Edit profile' }).click();
  await expect(page.getByRole('form', { name: 'Edit profile' })).toBeVisible();
  await scan('/account (edit profile)');
  expect(problems, problems.join('\n')).toEqual([]);
});
