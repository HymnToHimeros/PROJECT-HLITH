// @vitest-environment node
/**
 * T54 (ERROR-FIX's outsider test: "Kafka has no build score"): every released character in both games has the game's
 * own recommended build (sets, main stats, sub stats; the weapon only where the game names one) and an average build
 * scores against it. Characters not out yet get the beta files' recommendation, marked "beta, may change"; once the
 * live files carry them (a version's second-half characters ship in its release files), the live one, unmarked.
 */
import { describe, expect, it } from 'vitest';
import type { Character, GameContract, RecommendedBuild } from '../src/core/contract';
import { averageBuild, type AssumeFacts } from '../src/core/rules/averageBuild';
import { hsr } from '../src/games/hsr/contract';
import { ASSUME as HSR_ASSUME } from '../src/games/hsr/assumed';
import hsrBuilds from '../src/games/hsr/data/builds.json';
import hsrChars from '../src/games/hsr/data/characters.json';
import { zzz } from '../src/games/zzz/contract';
import { ASSUME as ZZZ_ASSUME } from '../src/games/zzz/assumed';
import zzzBuilds from '../src/games/zzz/data/builds.json';
import zzzChars from '../src/games/zzz/data/characters.json';

type C = Character & { leak?: unknown };
const GAMES: [string, GameContract, AssumeFacts, RecommendedBuild[], C[]][] = [
  ['HSR', hsr, HSR_ASSUME, hsrBuilds as unknown as RecommendedBuild[], hsrChars as C[]],
  ['ZZZ', zzz, ZZZ_ASSUME, zzzBuilds as unknown as RecommendedBuild[], zzzChars as C[]],
];
const released = (c: C) => !c.leak && !(c.releasedAt && Date.parse(c.releasedAt) > Date.now());
const complete = (r: RecommendedBuild | undefined) => !!r && r.sets.some((s) => s.options.length) && Object.keys(r.mainStats).length > 0 && r.subStats.length > 0;

describe.each(GAMES)('%s recommended builds', (_name, game, facts, builds, chars) => {
  const recOf = (id: string) => builds.find((b) => b.characterId === id);

  it('every released character has one (this list stays empty; anyone on it shows "No data yet")', () => {
    const missing = chars.filter(released).filter((c) => !complete(recOf(c.id))).map((c) => `${c.name} (${c.id})`);
    expect(missing).toEqual([]);
  });

  it('every released character’s average build scores against it', () => {
    const unscored = chars.filter(released).filter((c) => {
      const rec = recOf(c.id);
      return !rec || !game.rules.scoreBuild?.(averageBuild(c.id, rec, facts)).known;
    });
    expect(unscored.map((c) => c.name)).toEqual([]);
  });

  it('a recommendation from the beta files is marked "beta, may change" with its build, and only a character not out yet has one', () => {
    for (const c of chars.filter((x) => !released(x))) {
      const rec = recOf(c.id);
      if (!rec?.beta) continue;
      expect(rec.version, c.name).toBeTruthy();
      expect(rec.source, c.name).toContain('beta, may change');
    }
    // No released character is marked beta.
    expect(chars.filter(released).filter((c) => recOf(c.id)?.beta).map((c) => c.name)).toEqual([]);
  });
});

describe('the build score says why there is no score (T54)', () => {
  const rate = (b: Parameters<NonNullable<GameContract['rules']['scoreBuild']>>[0]) => hsr.rules.scoreBuild?.(b);
  it('Kafka with only level and weapon: too few parts, add more (not "no recommended build")', () => {
    const out = rate({ characterId: '1005', level: 80, dupes: 0, weapon: { name: 'Patience Is All You Need' }, gear: [] });
    expect(out).toEqual({ known: false, fix: 'enter-manually' });
    expect(rate({ characterId: '1005', level: 80, dupes: 0, weapon: { name: 'Patience Is All You Need', level: 80 }, gear: [] })?.known).toBe(true);
  });
  it('no recommendation at all: nothing to add', () => {
    expect(rate({ characterId: 'no-such', level: 80, dupes: 0, gear: [] })).toEqual({ known: false });
  });
  it('Severian, Phoenix (ZZZ) and Aeon ★ Aha (HSR) have a recommendation, never marked beta after their release date', () => {
    for (const [builds, list, id] of [[zzzBuilds, zzzChars, '1631'], [zzzBuilds, zzzChars, '1641'], [hsrBuilds, hsrChars, '1511']] as const) {
      const rec = (builds as unknown as RecommendedBuild[]).find((b) => b.characterId === id);
      const c = (list as { id: string; releasedAt?: string }[]).find((x) => x.id === id);
      const out = c?.releasedAt !== undefined && Date.parse(c.releasedAt) <= Date.now();
      expect(rec, id).toBeTruthy();
      if (out) expect(rec?.beta, id).toBeUndefined();
    }
  });
});
