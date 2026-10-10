// @vitest-environment node
/** Every W-Engine that isn't a signature is read, quote for quote (T18 step 4, docs/logic/hsr-decisions.md 29). */
import { describe, expect, it } from 'vitest';
import weapons from '../data/weapons.json';
import { GENERAL_STATS, SPECIFIC_STATS, SUPPORT_STATS } from './types';
import { WEAPON_SHEETS } from './weapons';

type W = { id: string; name: string; madeFor?: string; role?: string; effect?: { name: string; text: string } };
const STATS = new Set([...GENERAL_STATS, ...SPECIFIC_STATS, ...SUPPORT_STATS]);
const toRead = (weapons as W[]).filter((w) => w.effect && !w.madeFor);

describe('ZZZ W-Engines read for the kit check', () => {
  it('each is read once, and only weapons from the list', () => {
    const ids = WEAPON_SHEETS.map((s) => s.weaponId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(toRead.some((w) => w.id === id), `${id} is a non-signature W-Engine with effect text`).toBe(true);
  });

  it.each(toRead.map((w) => [`${w.name} (${w.id})`, w] as const))('%s: read, every quote word for word', (_, w) => {
    const sheet = WEAPON_SHEETS.find((s) => s.weaponId === w.id);
    expect(sheet, 'read').toBeTruthy();
    if (!sheet) return;
    expect(sheet.entries.length > 0 || (sheet.nothing ?? '').length > 5, 'entries, or "nothing" with why').toBe(true);
    const text = w.effect?.text ?? '';
    const ids = new Set<string>();
    for (const e of sheet.entries) {
      expect(ids.has(e.id), `duplicate entry id ${e.id}`).toBe(false);
      ids.add(e.id);
      expect(e.piece, `${e.id}: piece`).toBe('effect');
      expect(e.quote.length, `${e.id}: quote not empty`).toBeGreaterThan(8);
      expect(text, `${e.id}: quote is word for word`).toContain(e.quote);
      expect(e.setup.length, `${e.id}: setup answered`).toBeGreaterThan(2);
      for (const g of e.gives) expect(STATS.has(g.stat), `${e.id}: stat ${g.stat}`).toBe(true);
      if (e.scales) expect(text, `${e.id}: scaling quote`).toContain(e.scales.quote);
    }
  });
});
