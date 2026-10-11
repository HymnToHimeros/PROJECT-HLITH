import { describe, expect, it } from 'vitest';
import { games } from '../src/games';

// The standard-pool top results decide a lost 50/50 in imported pull history: every id must be a
// released character or weapon from the game's own lists, and a featured banner's own top never is.
describe('standard pool (historyMapping.standardTop)', () => {
  it.each(games.filter((g) => g.historyMapping).map((g) => [g.id, g] as const))('%s: every id is a released character or weapon', async (_id, g) => {
    const ids = g.historyMapping?.standardTop ?? [];
    expect(ids.length).toBeGreaterThan(0);
    const [chars, weapons, banners] = await Promise.all([g.data.characters(), g.data.weapons ? g.data.weapons() : Promise.resolve([]), g.data.banners()]);
    const known = new Map([...chars, ...weapons].map((x) => [x.id, x as { leak?: unknown }]));
    for (const id of ids) {
      expect(known.has(id), id).toBe(true);
      expect(known.get(id)?.leak, id).toBeUndefined();
    }
    for (const b of banners) if (!b.permanent) expect(ids, b.id).not.toContain(b.featured[0]);
  });
});
