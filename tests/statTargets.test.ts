// @vitest-environment node
/** T35: end stats to build towards, only from numbers the game text states, each quote checked against the game data. */
import { describe, expect, it } from 'vitest';
import type { RecommendedBuild } from '../src/core/contract';
import hsrBuilds from '../src/games/hsr/data/builds.json';
import hsrKits from '../src/games/hsr/data/kits.json';
import hsrWeapons from '../src/games/hsr/data/weapons.json';
import { HSR_FACTS, HSR_SETS, hsrStatTargets, TOTAL_STATS as HSR_STATS } from '../src/games/hsr/statTargets';
import zzzBuilds from '../src/games/zzz/data/builds.json';
import zzzKits from '../src/games/zzz/data/kits.json';
import zzzWeapons from '../src/games/zzz/data/weapons.json';
import { TOTAL_STATS as ZZZ_STATS, ZZZ_FACTS, ZZZ_SETS, zzzStatTargets } from '../src/games/zzz/statTargets';

type KitRow = { characterId: string; skills: { label?: string; gameText?: string }[] };
type WeaponRow = { name: string; madeFor?: string; effect?: { text?: string } };

const games = [
  { game: 'HSR', facts: HSR_FACTS, sets: HSR_SETS, stats: HSR_STATS, kits: hsrKits as KitRow[], weapons: hsrWeapons as WeaponRow[], builds: hsrBuilds as unknown as RecommendedBuild[] },
  { game: 'ZZZ', facts: ZZZ_FACTS, sets: ZZZ_SETS, stats: ZZZ_STATS, kits: zzzKits as KitRow[], weapons: zzzWeapons as WeaponRow[], builds: zzzBuilds as unknown as RecommendedBuild[] },
];

describe.each(games)('$game target stats: every number is in the game text', ({ facts, sets, stats, kits, weapons, builds }) => {
  it('every target names a stat on the game’s stat screen (the build form offers exactly these)', () => {
    for (const f of [...facts, ...sets]) expect(stats).toContain(f.stat);
  });

  it.each(facts.map((f) => [f.characterId, f.source, f] as const))('%s · %s: the quote is word for word in that kit piece or signature', (_id, _src, f) => {
    if (f.source.startsWith('Kit: ')) {
      const label = f.source.slice(5);
      const kit = kits.find((k) => k.characterId === f.characterId);
      const skill = kit?.skills.find((s) => s.label === label || s.label?.startsWith(`${label} (`));
      expect(skill, `${label} in ${f.characterId}'s kit`).toBeDefined();
      expect(skill?.gameText).toContain(f.quote);
    } else {
      expect(f.source).toMatch(/^Signature: /);
      const w = weapons.find((x) => x.name === f.source.slice(11));
      expect(w?.madeFor).toBe(f.characterId);
      expect(w?.effect?.text).toContain(f.quote);
    }
  });

  it.each(sets.map((s) => [s.set, s] as const))('%s: the condition is word for word in the set’s own text', (_n, s) => {
    const texts = builds.flatMap((b) => b.items?.[s.set]?.effects.map((e) => e.text) ?? []);
    expect(texts.length, `${s.set} in the recommended builds`).toBeGreaterThan(0);
    expect(texts.some((t) => t.includes(s.quote))).toBe(true);
  });

  it('every number shows up in its quote or its working', () => {
    for (const f of [...facts, ...sets]) {
      const shown = `${f.quote} ${f.working ?? ''}`.replace(/,/g, '');
      expect(shown, `${f.stat} ${f.value}`).toContain(String(f.value));
    }
  });
});

describe('Target stats on the character page', () => {
  it('HSR Jiaoqiu: 140% Effect Hit Rate with the working, and "you" from the saved totals', () => {
    const none = hsrStatTargets('1218');
    expect(none.rows[0]).toMatchObject({ stat: 'Effect Hit Rate', target: '140%', source: 'Kit: Trace: Hearth Kindle', working: '80% + 4 × 15% (240% ÷ 60% per step) = 140%' });
    expect(none.rows[0]?.you).toBeUndefined();
    expect(none.rows[0]?.met).toBeUndefined();
    const saved = hsrStatTargets('1218', { characterId: '1218', level: 80, dupes: 0, gear: [], totals: { 'Effect Hit Rate %': 121.4 } });
    expect(saved.rows[0]).toMatchObject({ you: '121.4%', met: false });
  });

  it('recommended sets add their own conditions; the direction is the game’s recommended stats, no numbers', () => {
    const withGlamoth = hsrBuilds.find((b) => (b as unknown as RecommendedBuild).sets.some((s) => s.options.includes('Firmament Frontline: Glamoth')));
    if (!withGlamoth) throw new Error('no character with Glamoth recommended');
    const t = hsrStatTargets(withGlamoth.characterId);
    expect(t.rows.some((r) => r.source === 'Set: Firmament Frontline: Glamoth (recommended)' && r.target === '160 (steps 135 / 160)')).toBe(true);
    expect(t.direction?.subs.length).toBeGreaterThan(0);
  });

  it('a character the game text gives no number for has no rows: the page says "No data yet"', () => {
    const plain = (hsrBuilds as unknown as RecommendedBuild[]).find((b) => !HSR_FACTS.some((f) => f.characterId === b.characterId) && !b.sets.some((s) => s.options.some((o) => HSR_SETS.some((x) => x.set === o))));
    if (!plain) throw new Error('every character has a number');
    expect(hsrStatTargets(plain.characterId).rows).toEqual([]);
  });

  it('ZZZ Lucia: 24,000 initial Max HP; uncapped thresholds say so', () => {
    expect(zzzStatTargets('1451').rows[0]).toMatchObject({ stat: 'HP', target: '24,000 initial' });
    const alice = zzzStatTargets('1401').rows[0];
    expect(alice?.target).toBe('above 140 (no cap in the text)');
    const saved = zzzStatTargets('1401', { characterId: '1401', level: 60, dupes: 0, gear: [], totals: { 'Anomaly Mastery': 140 } });
    expect(saved.rows[0]?.met).toBe(false);
  });
});
