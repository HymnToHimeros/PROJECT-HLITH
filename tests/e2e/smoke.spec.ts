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
  await intelRow.getByRole('button', { name: 'Hide Intel' }).click();
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
  await page.getByRole('button', { name: 'Customise profile' }).click();
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

/** A striped test picture made in the browser, as a file to pick. */
const testPicture = async (page: import('@playwright/test').Page, w: number, h: number) => {
  const b64 = await page.evaluate(
    ({ w, h }) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      if (!ctx) return '';
      for (let x = 0; x < w; x += 40) {
        ctx.fillStyle = `hsl(${(x / w) * 360} 70% 55%)`;
        ctx.fillRect(x, 0, 40, h);
      }
      return c.toDataURL('image/png').split(',')[1] ?? '';
    },
    { w, h },
  );
  return { name: 'test.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') };
};

test('Profile: pick a picture and a banner, move and zoom them, and save exactly that', async ({ page }) => {
  await page.goto('/account');
  await page.getByRole('button', { name: 'Customise profile' }).click();

  await page.getByLabel('Choose picture').setInputFiles(await testPicture(page, 1200, 800));
  const sheet = page.getByRole('dialog', { name: 'Adjust picture' });
  const frame = sheet.getByRole('application');
  await expect(frame).toBeVisible();
  await noSidewaysScroll(page);
  // Drag with the mouse, then keys and buttons.
  const box = await frame.boundingBox();
  if (!box) throw new Error('no frame');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2, { steps: 4 });
  await page.mouse.up();
  await frame.focus();
  await page.keyboard.press('ArrowLeft');
  await sheet.getByRole('button', { name: 'Zoom in' }).click();
  await expect(sheet.getByRole('slider', { name: 'Zoom' })).toHaveAttribute('aria-valuetext', '115%');
  await sheet.getByRole('button', { name: 'Use this picture' }).click();
  await expect(sheet).toHaveCount(0);

  await page.getByLabel('Choose banner').setInputFiles(await testPicture(page, 900, 900));
  const bannerSheet = page.getByRole('dialog', { name: 'Adjust banner' });
  await expect(bannerSheet.getByRole('application')).toBeVisible();
  await noSidewaysScroll(page);
  await bannerSheet.getByRole('button', { name: 'Fit' }).click();
  await expect(bannerSheet.getByText(/Edges with no picture/)).toBeVisible();
  await bannerSheet.getByRole('button', { name: 'Fill' }).click();
  await bannerSheet.getByRole('button', { name: 'Use this banner' }).click();

  // Adjust again from the button, then cancel: nothing changes.
  await page.getByRole('button', { name: 'Adjust picture' }).click();
  await expect(page.getByRole('dialog', { name: 'Adjust picture' }).getByRole('application')).toBeVisible();
  await page.getByRole('dialog', { name: 'Adjust picture' }).getByRole('button', { name: 'Cancel' }).click();

  await page.getByRole('button', { name: 'Save profile' }).click();
  const hero = page.getByRole('article', { name: /Profile card/ });
  await expect(hero).toBeVisible();
  const sizes = await hero.locator('img').evaluateAll((imgs) => (imgs as HTMLImageElement[]).map((i) => [i.src.slice(0, 15), i.naturalWidth, i.naturalHeight]));
  expect(sizes).toEqual([
    ['data:image/jpeg', 1600, 400],
    ['data:image/jpeg', 512, 512],
  ]);
  await noSidewaysScroll(page);
});

test('Choose server on Today opens Account → Game settings for that game, and back to the server chip', async ({ page }) => {
  await page.goto('/hsr/today');
  await page.getByRole('button', { name: 'Choose HSR server' }).click();
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

for (const scope of ['all', 'hsr', 'zzz']) {
  for (const module of ['today', 'pulls', 'roster', 'calendar', 'events', 'banners', 'backlog', 'farm', 'intel']) {
    test(`every module opens a real screen, with no errors · ${scope} ${module}`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(`/${scope}/${module}`);
      await expect(page.getByText('BEING BUILT')).toHaveCount(0);
      await expect(page.getByText('Loading…')).toHaveCount(0);
      await noSidewaysScroll(page);
      expect(errors).toEqual([]);
    });
  }
}
