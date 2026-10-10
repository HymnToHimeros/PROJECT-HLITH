// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { TeamAccount } from '../../../core/contract';
import { buildLibrary, library, SHEETS } from './library';
import { ifYouPull, lineUps, recommendedTeams, synergyLabel, verdict, whoFits } from './team';

/** Every agent is read now; leave one sheet out on purpose to test "not read yet". */
const unreadAnby = buildLibrary(SHEETS.filter((s) => s.characterId !== '1011'));

const BILLY = '1531';
const DIALYN = '1481';
const LUCIA = '1451';
const PAN = '1421';

const account = (owned: string[], dupes: Record<string, number> = { [BILLY]: 1, [PAN]: 6 }): TeamAccount => ({
  owned: (id) => owned.includes(id),
  dupes: (id) => dupes[id] ?? 0,
});
const all = account([BILLY, DIALYN, LUCIA, PAN]);
/** A saved build with this stat's % main stat on Discs 4–6 and 6 rolls of it: built for it (decision 25). */
const builtFor = (stat: string) => ({ characterId: 'x', level: 60, dupes: 0, gear: ['Disc 4', 'Disc 5', 'Disc 6'].map((slot) => ({ slot, main: `${stat} %`, subs: { [`${stat} %`]: 3 }, rolls: { [`${stat} %`]: 2 } })) });

describe('Synergy % on presets', () => {
  // The method's worked example still counts as written (9 against 10). T30 (zzz-decisions 61) ranks squads by kit
  // value on top of the count: Lucia and Pan Yinhu both give Sheer Force (one zone, so they add up), and Dialyn's
  // +40% DMG, Stun multiplier and free Ultimate are kinds of their own. Owner's T38: Billy > Dialyn > Lucia is the
  // best squad, and Billy > Pan Yinhu > Lucia is only "Partly".
  it('the method’s counts stand (9 and 10), and by kit value Billy > Dialyn > Lucia is the best squad (owner’s T38)', () => {
    const v = verdict([BILLY, DIALYN, LUCIA], all);
    expect(v).toMatchObject({ rated: true, count: 9, percent: 87, label: 'Excellent', order: [BILLY, DIALYN, LUCIA], bestMembers: [BILLY, DIALYN, LUCIA] });
    expect(verdict([BILLY, PAN, LUCIA], all)).toMatchObject({ rated: true, count: 10, percent: 60, label: 'Partly', bestMembers: [BILLY, DIALYN, LUCIA] });
  });

  it('100% when the check knows no better squad and it is built for what it wants', () => {
    const built = { ...all, build: (id: string) => (id === LUCIA ? builtFor('HP') : undefined) };
    expect(verdict([BILLY, DIALYN, LUCIA], built)).toMatchObject({ rated: true, count: 11, percent: 100 });
  });

  it('every reason that counts names the kit text that proves it', () => {
    const v = verdict([BILLY, DIALYN, LUCIA], all);
    if (!v.rated) throw new Error('not rated');
    const counted = v.reasons.filter((x) => x.group === 'counted');
    expect(counted.reduce((n, x) => n + x.points, 0)).toBe(9);
    for (const x of counted) expect(x.proof?.quote.length).toBeGreaterThan(10);
    expect(counted.find((x) => x.text.includes('Overwhelmingly') || x.text.includes('+40% DMG'))?.proof?.skill).toBe('Additional Ability: External Line');
  });

  it('with fewer than three owned, it compares with every agent and says so', () => {
    const v = verdict([BILLY, DIALYN, LUCIA], account([BILLY]));
    expect(v.rated && v.notes.join(' ')).toContain('compares with every agent');
  });

  it('labels follow the method’s table', () => {
    expect([90, 85, 84, 65, 64, 45, 44].map((p) => synergyLabel(p, 3))).toEqual(['Excellent', 'Excellent', 'Good', 'Good', 'Partly', 'Partly', 'Weak']);
    expect(synergyLabel(100, 2)).toBe('Incomplete');
  });

  it('a squad with an agent whose kit isn’t read yet is not rated', () => {
    expect(verdict([BILLY, DIALYN, '1011'], all, unreadAnby)).toMatchObject({ rated: false });
  });
});

describe('Line-ups', () => {
  it('your best team with no character twice', () => {
    expect(lineUps(all)).toEqual([expect.objectContaining({ members: [BILLY, DIALYN, LUCIA], count: 9 })]);
  });

  it('nothing without a damage dealer', () => {
    expect(lineUps(account([DIALYN, LUCIA, PAN]))).toEqual([]);
  });
});

describe('Who fits', () => {
  it('for Starlight Billy: only agents whose kits connect, saying how', () => {
    // Every agent whose kit connects, owned or not (as on a character page).
    const fits = whoFits([BILLY], all, library(), { includeUnowned: true });
    expect(fits.map((f) => f.id)).toEqual(expect.arrayContaining([DIALYN, LUCIA, PAN]));
    // Lighter (Stun) switches on Billy's Starlight, but his Ice and Fire buffs never count for a Physical Billy.
    const lighter = fits.find((f) => f.id === '1161');
    expect(lighter?.how.join(' | ')).toContain("turns on Starlight - Billy's Additional Ability");
    expect(lighter?.how.join(' | ')).not.toMatch(/Ice and Fire/);
    const dialyn = fits.find((f) => f.id === DIALYN);
    expect(dialyn?.how.join(' | ')).toContain("turns on Starlight - Billy's Additional Ability: Blazing Starlight");
  });

  it('for Billy and Dialyn: Pan Yinhu and Lucia both connect', () => {
    expect(whoFits([BILLY, DIALYN], all).map((f) => f.id)).toEqual(expect.arrayContaining([LUCIA, PAN]));
  });
});

describe('If you pull…', () => {
  it('as a teammate: Pan Yinhu adds nothing to Billy > Dialyn > Lucia; Lucia brings Billy’s best squad to the most possible', () => {
    // By kit value Pan Yinhu's Sheer Force only adds to Lucia's (one zone): with Billy, Dialyn and Lucia there's no gain.
    const v = ifYouPull(PAN, account([BILLY, DIALYN, LUCIA], { [BILLY]: 1 }));
    expect(v).toMatchObject({ percent: 0, why: ['No gain: no team of yours gets a higher kit value with them.'] });
    const owner = ifYouPull(LUCIA, account([BILLY, DIALYN, PAN], { [BILLY]: 1, [PAN]: 6 }));
    expect(owner?.percent).toBe(100);
    expect(owner?.why.join(' ')).toContain("As a teammate: Starlight - Billy's best squad of yours goes from");
    // And in plain words what Lucia gives him.
    expect(owner?.why.join(' ')).toMatch(/Lucia gives Starlight - Billy /);
  });

  it('as a damage dealer: Billy with your agents against every agent', () => {
    const v = ifYouPull(BILLY, account([DIALYN, LUCIA, PAN], { [PAN]: 6 }));
    expect(v?.percent).toBe(100);
    expect(v?.why[0]).toContain('As a damage dealer');
  });

  it('unread agents are not rated', () => {
    expect(ifYouPull('1011', all, unreadAnby)).toBeNull();
  });
});

describe('Recommended teams from the check', () => {
  it("Starlight Billy's, fully built at Mindscape 0, is Billy > Dialyn > Lucia (count 11, the best kit value), with alternatives per place", () => {
    const t0 = Date.now();
    const teams = recommendedTeams();
    expect(Date.now() - t0).toBeLessThan(8000);
    const billy = teams.find((t) => t.id === `kit-check-${BILLY}`);
    // The method's own squad, Billy > Dialyn > Lucia, is the best by kit value (owner's T38); fully built it counts 11.
    expect(billy?.slots.map((s) => s.characters[0])).toEqual([BILLY, DIALYN, LUCIA]);
    expect(billy?.source).toContain('count 11, ×');
    expect(billy?.slots[1]?.characters.length).toBeGreaterThan(1);
  });
});

describe('Builds a team wants (T18): counted in ZZZ as in HSR (owner’s ruling 2026-10-10)', () => {
  it('Pan Yinhu’s ATK-based buff asks for an ATK build: none saved scores at base, built adds 2', () => {
    const lib = library();
    const a = { owned: () => true, dupes: () => 0 };
    const v = verdict(['1531', '1421', '1451'], a, lib);
    if (!v.rated) throw new Error(v.why);
    const pan = v.wants?.find((w) => w.who === '1421');
    expect(pan).toMatchObject({ stat: 'ATK', points: 0, max: 2, fit: 'no-build' });
    const built = verdict(['1531', '1421', '1451'], { ...a, build: (id: string) => (id === '1421' ? builtFor('ATK') : undefined) }, lib);
    if (!built.rated) throw new Error(built.why);
    expect(built.wants?.find((w) => w.who === '1421')).toMatchObject({ fit: 'built', points: 2 });
    expect(built.count).toBe(v.count + 2);
    expect(lib.sheets.get('1421')?.entries.some((e) => e.scales?.stat === 'atk')).toBe(true);
  });
});

describe('Any equipped W-Engine counts when its specialty is the wearer’s (T18 step 4)', () => {
  const kaboom = { id: '13115', name: 'Kaboom the Cannon' };
  const with_ = (who: string) => verdict([BILLY, DIALYN, LUCIA], { ...account([BILLY, DIALYN, LUCIA]), weapon: (x) => (x === who ? kaboom : undefined) });
  it('Kaboom the Cannon (Support) on Lucia (Support) is read, named as the proof', () => {
    const v = with_(LUCIA);
    if (!v.rated) throw new Error(v.why);
    expect(v.reasons.some((x) => x.proof?.skill === 'W-Engine: Kaboom the Cannon')).toBe(true);
  });
  it('on Starlight Billy (Attack) it does nothing: its effect only works for Support agents', () => {
    const v = with_(BILLY);
    if (!v.rated) throw new Error(v.why);
    expect(v.reasons.some((x) => x.proof?.skill === 'W-Engine: Kaboom the Cannon')).toBe(false);
  });
});
