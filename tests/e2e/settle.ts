import { expect, type Page } from '@playwright/test';

/**
 * Waits until every short animation on the page has finished (screens and cards easing in,
 * T50), so checks like colour contrast measure the settled screen the person reads, not a
 * half-faded one. Endless background animations are left alone.
 */
export async function settled(page: Page): Promise<void> {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
}

/**
 * The screen is ready to scan: nothing says "Loading…", the web fonts (served by the app) are in,
 * and short animations have finished. Deliberately not `networkidle`: pages load character
 * pictures from an outside host, and one slow picture there kept a page from ever going idle
 * (a 30 s timeout on HSR Farm), though the screen the person reads was long finished.
 */
export async function readyToScan(page: Page): Promise<void> {
  await expect(page.getByText('Loading…')).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await settled(page);
}
