// @vitest-environment node
/** T39: leaked characters can be used in teams (pre-pull), always marked unverified; hidden leaks join no one else's. */
import { describe, expect, it } from 'vitest';
import type { TeamAccount } from '../src/core/contract';
import { library as hsrLib } from '../src/games/hsr/kitcheck/library';
import { ifYouPull as hsrPull, verdict as hsrVerdict, whoFits as hsrFits } from '../src/games/hsr/kitcheck/team';
import { library as zzzLib } from '../src/games/zzz/kitcheck/library';
import { ifYouPull as zzzPull, verdict as zzzVerdict } from '../src/games/zzz/kitcheck/team';

const idOf = (lib: { names: Map<string, string> }, n: string) => [...lib.names].find(([, v]) => v === n)?.[0] ?? n;
const NIHILUX = '1511';
// A real account: owns the released characters, never a leak (a leak can be wanted, not owned).
const account = (lib: { leaks?: Map<string, string> }, showLeaks = false): TeamAccount => ({ owned: (id) => !lib.leaks?.has(id), dupes: () => 0, showLeaks });

describe('HSR: Aeon ★ Aha, a leak with beta kit text', () => {
  const lib = hsrLib();

  it('is listed as a leak, with where it came from', () => {
    expect(lib.leaks?.get(NIHILUX)).toMatch(/game files/);
  });

  it('If you pull (pre-pull): says it is a leak first, that there is no game team list yet, then what they would carry', () => {
    const v = hsrPull(NIHILUX, account(lib), lib);
    if (!v) throw new Error('not rated');
    expect(v.why[0]).toMatch(/^Leak: Aeon ★ Aha: unverified beta kit, may change \(.+\)\.$/);
    expect(v.why[1]).toBe('No game team list yet for Aeon ★ Aha: teammates are the characters whose kits connect with theirs.');
    expect(v.why.some((w) => w.startsWith('As a damage dealer: your best team for them is'))).toBe(true);
    expect(v.percent).toBeGreaterThan(0);
    expect(v.percent).toBeLessThanOrEqual(100);
  });

  it('a team with them is scored and marked, in the notes and in the plain words', () => {
    const fits = hsrFits([NIHILUX], account(lib), lib).slice(0, 3).map((f) => f.id);
    const v = hsrVerdict([NIHILUX, ...fits], account(lib), lib);
    if (!v.rated || !v.explain) throw new Error('not rated');
    expect(v.notes.some((n) => n.startsWith('Leak: Aeon ★ Aha: unverified beta kit, may change'))).toBe(true);
    expect(v.explain.missing.slice(-2)[0]).toMatch(/^Leak: Aeon ★ Aha/);
    expect(v.explain.missing.at(-1)).toMatch(/^No game team list yet for Aeon ★ Aha/);
  });

  it('hidden leaks join no released character’s pool; shown, they are marked wherever they are suggested', () => {
    const fx = idOf(lib, 'Feixiao');
    const hidden = hsrFits([fx], account(lib), lib, { includeUnowned: true });
    expect(hidden.some((f) => f.id === NIHILUX)).toBe(false);
    const v = hsrVerdict(['Feixiao', 'Topaz & Numby', 'Robin', 'Aventurine'].map((n) => idOf(lib, n)), account(lib), lib);
    if (!v.rated) throw new Error('not rated');
    expect(v.notes.join(' ')).not.toMatch(/Aeon ★ Aha|Leak:/);
    const shown = hsrFits([NIHILUX], account(lib, true), lib, { includeUnowned: true });
    for (const f of shown.filter((x) => lib.leaks?.has(x.id))) expect(f.fromAccount?.[0]).toMatch(/^Leak: /);
  });
});

describe('ZZZ mirrors it (no leaks listed today, so one is made up for the test)', () => {
  const base = zzzLib();
  const id = idOf(base, 'Lucia');
  const lib = { ...base, leaks: new Map([[id, 'test leak']]) };

  it('If you pull and a squad with the leak say so', () => {
    const p = zzzPull(id, account(lib), lib);
    expect(p?.why[0]).toBe('Leak: Lucia: unverified beta kit, may change (test leak).');
    const v = zzzVerdict(['Starlight - Billy', 'Dialyn', 'Lucia'].map((n) => idOf(lib, n)), account(lib), lib);
    if (!v.rated || !v.explain) throw new Error('not rated');
    expect(v.explain.missing.at(-1)).toBe('Leak: Lucia: unverified beta kit, may change (test leak).');
  });
});

describe('Kit importers: leaks are read on every run, raw text keys are never shown', () => {
  it('a raw key where a name belongs shows "No name yet"; real names stay', async () => {
    const { shownName, leakedIds } = await import('../scripts/kits/names.ts');
    expect(shownName('Severian_Talent_01_Title')).toBe('No name yet');
    expect(shownName('Survivor')).toBe('Survivor');
    expect(shownName('Wind Shear - Purifying Rise')).toBe('Wind Shear - Purifying Rise');
    // The manifest's new characters that aren't live yet are the leaks.
    expect(leakedIds({ character: [1511, 1415] }, { '1415': {} })).toEqual(['1511']);
    expect(leakedIds(undefined, {})).toEqual([]);
  });

  it('no stored kit label shows a raw text key (both games)', async () => {
    const raw = /(^|: )[A-Za-z0-9]+(?:_[A-Za-z0-9]+)+($| \()/;
    for (const file of ['../src/games/hsr/data/kits.json', '../src/games/zzz/data/kits.json']) {
      const kits = (await import(file)).default as { characterId: string; skills: { label: string }[] }[];
      for (const k of kits) for (const s of k.skills) expect(s.label, `${k.characterId} ${s.label}`).not.toMatch(raw);
    }
  });
});
