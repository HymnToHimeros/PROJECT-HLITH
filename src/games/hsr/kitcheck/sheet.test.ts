// @vitest-environment node
/** The cheat sheet's honesty tests (docs/logic/hsr-theory.md, Part A step 6). */
import { describe, expect, it } from 'vitest';
import characters from '../data/characters.json';
import { KITS as kits, SHEETS } from './library';
import { GENERAL_STATS, SPECIFIC_STATS, SUPPORT_STATS } from './types';

type K = { characterId: string; skills: { id: string; gameText: string }[] };
const kitOf = (id: string) => (kits as K[]).find((k) => k.characterId === id);
const STATS = new Set([...GENERAL_STATS, ...SPECIFIC_STATS, ...SUPPORT_STATS]);

describe('HSR cheat sheet', () => {
  it('no character is read twice', () => {
    const ids = SHEETS.map((s) => s.characterId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(SHEETS.map((s) => [`${s.name} (${s.characterId})`, s] as const))('%s: every quote word for word, every piece read', (_, sheet) => {
    const kit = kitOf(sheet.characterId);
    expect(kit, 'kit text exists').toBeTruthy();
    expect(characters.find((c) => c.id === sheet.characterId)).toBeTruthy();
    const text = (piece: string) => kit?.skills.find((s) => s.id === piece)?.gameText;
    const ids = new Set<string>();
    for (const e of sheet.entries) {
      expect(ids.has(e.id), `duplicate entry id ${e.id}`).toBe(false);
      ids.add(e.id);
      const t = text(e.piece);
      expect(t, `${e.id}: piece ${e.piece} exists`).toBeTruthy();
      expect(e.quote.length, `${e.id}: quote not empty`).toBeGreaterThan(8);
      expect(t, `${e.id}: quote is word for word`).toContain(e.quote);
      expect(e.setup.length, `${e.id}: setup answered`).toBeGreaterThan(2);
      for (const g of e.gives) expect(STATS.has(g.stat), `${e.id}: stat ${g.stat}`).toBe(true);
      if (e.scales) {
        expect(t, `${e.id}: scaling quote is word for word`).toContain(e.scales.quote);
        for (const g of e.scales.gives ?? []) expect(e.gives.some((x) => x.stat === g), `${e.id}: scales a stat it gives`).toBe(true);
      }
      if (e.on && 'count' in e.on) expect(e.on.count.paths?.length || e.on.count.elements?.length, `${e.id}: condition names a path or element`).toBeTruthy();
    }
    for (const q of sheet.damage?.quotes ?? []) expect(text(q.piece), `damage quote in ${q.piece}`).toContain(q.quote);
    const alone = sheet.damage?.alone;
    if (alone) for (const q of [alone.quote, ...(alone.turns ? [alone.turns.quote] : [])]) expect(text(alone.piece), `alone quote in ${alone.piece}`).toContain(q);
    if (sheet.damage) expect(sheet.damage.kinds.length, 'damage kinds').toBeGreaterThan(0);
    for (const s of kit?.skills ?? []) {
      const read = sheet.entries.some((e) => e.piece === s.id) || s.id in sheet.nothing;
      expect(read, `piece ${s.id} is read (an entry, or in "nothing" with why)`).toBe(true);
    }
    for (const p of Object.keys(sheet.nothing)) expect(text(p), `"nothing" piece ${p} exists`).toBeTruthy();
  });
});
