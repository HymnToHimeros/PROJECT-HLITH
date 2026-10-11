import type { Page } from '@playwright/test';

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
