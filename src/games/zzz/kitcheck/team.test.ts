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
  // The method's worked example holds at base builds (no builds saved): 9 against 10. Builds count on top of the method
  // (owner's ruling 2026-10-10, zzz-decisions.md): the best squad found is scored fully built (Pan Yinhu for ATK,
  // Lucia for HP: +2 each), so the % compares against 14.
  it('the method’s example at base builds: Billy > Dialyn > Lucia counts 9, Billy > Pan Yinhu > Lucia 10; the best, fully built, 14', () => {
    const v = verdict([BILLY, DIALYN, LUCIA], all);
    expect(v).toMatchObject({ rated: true, count: 9, best: 14, percent: 64, order: [BILLY, DIALYN, LUCIA], bestMembers: [BILLY, PAN, LUCIA] });
    expect(verdict([BILLY, PAN, LUCIA], all)).toMatchObject({ rated: true, count: 10 });
  });

  it('100% when the check knows no better squad and it is built for what it wants', () => {
    expect(verdict([BILLY, PAN, LUCIA], all)).toMatchObject({ rated: true, percent: 71 });
    const built = { ...all, build: (id: string) => (id === PAN ? builtFor('ATK') : id === LUCIA ? builtFor('HP') : undefined) };
    expect(verdict([BILLY, PAN, LUCIA], built)).toMatchObject({ rated: true, count: 14, percent: 100 });
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
    expect(lineUps(all)).toEqual([expect.objectContaining({ members: [BILLY, PAN, LUCIA], count: 10 })]);
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
  it('as a teammate: Pan Yinhu (built for ATK) lifts Billy’s best squad; Lucia brings it to the most possible', () => {
    // Squads are scored fully built (decision 26): Pan Yinhu's ATK-based buff lifts Billy's best from 11 to 12.
    const v = ifYouPull(PAN, account([BILLY, DIALYN, LUCIA], { [BILLY]: 1 }));
    expect(v).toMatchObject({ percent: 100 });
    expect(v?.why.join(' ')).toMatch(/best when built for ATK \(assumed here\)/);
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
  it("Starlight Billy's, fully built at Mindscape 0, is Billy > Lucia > Roxy (count 12), with alternatives per place", () => {
    const t0 = Date.now();
    const teams = recommendedTeams();
    expect(Date.now() - t0).toBeLessThan(8000);
    const billy = teams.find((t) => t.id === `kit-check-${BILLY}`);
    // The method's Billy > Dialyn > Lucia (9 at base) gains only Lucia's HP build; Roxy's and Lucia's builds lift this one to 12.
    expect(billy?.slots.map((s) => s.characters[0])).toEqual([BILLY, LUCIA, '1621']);
    expect(billy?.source).toContain('(12)');
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
