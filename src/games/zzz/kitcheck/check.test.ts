// @vitest-environment node
import { describe, expect, it } from 'vitest';
import kits from '../data/kits.json';
import { checkOrder, checkSquad, type Account } from './check';
import { library, SHEETS } from './library';

const BILLY = '1531';
const DIALYN = '1481';
const LUCIA = '1451';
const PAN = '1421';

/** The owner's account in the method's examples: Starlight Billy M1; Pan Yinhu's M1 and M6 count, so M6; Dialyn and Lucia M0. */
const levels: Record<string, number> = { [BILLY]: 1, [PAN]: 6 };
const account: Account = { mindscape: (id) => levels[id] ?? 0, potential: () => undefined };
const lib = library();

describe('Part A: the cheat sheet is proven by the game text', () => {
  it.each(SHEETS.map((s) => [s.name, s] as const))('%s: every quote is word for word, every piece is read', (_n, sheet) => {
    const kit = kits.find((k) => k.characterId === sheet.characterId);
    expect(kit).toBeDefined();
    const text = new Map(kit?.skills.map((s) => [s.id, s.gameText]));
    for (const e of sheet.entries) {
      expect(text.get(e.piece), `${e.id}: piece ${e.piece}`).toBeDefined();
      expect(text.get(e.piece), `${e.id}: quote`).toContain(e.quote);
      expect(e.setup.length, `${e.id}: question 6`).toBeGreaterThan(3);
    }
    for (const q of sheet.damage?.quotes ?? []) expect(text.get(q.piece)).toContain(q.quote);
    // Every part read: each kit piece has entries or a reason it has nothing for the squad.
    for (const s of kit?.skills ?? []) {
      const read = sheet.entries.some((e) => e.piece === s.id) || s.id in sheet.nothing;
      expect(read, `${sheet.name}: ${s.id} not read`).toBe(true);
    }
    for (const id of Object.keys(sheet.nothing)) expect(text.has(id), `${sheet.name}: ${id} is not a kit piece`).toBe(true);
    const ids = sheet.entries.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of sheet.entries) if (e.upgrades) expect(ids).toContain(e.upgrades);
  });

  it('lines that sound like they need setup all answer question 6', () => {
    for (const s of SHEETS) for (const e of s.entries) if (/\b(when|after|while|upon|if)\b/i.test(e.quote)) expect(e.setup, `${s.name} ${e.id}`).not.toMatch(/^$/);
  });
});

describe('Part B: the worked example, Starlight Billy > Dialyn > Lucia', () => {
  const r = checkOrder([BILLY, DIALYN, LUCIA], BILLY, lib, account);
  const of = (kind: string) => r.lines.filter((l) => l.kind === kind);

  it('counts 9', () => {
    expect(r.count).toBe(9);
  });

  it('switches on Billy’s Starlight (+1)', () => {
    expect(of('switched-on').map((l) => l.entry)).toEqual(['starlight']);
  });

  it('Dialyn gives +30% Stun DMG Multiplier and +40% DMG; Lucia gives Max HP, DMG, Sheer Force and CRIT DMG (+6)', () => {
    expect(of('buff').map((l) => `${l.who}:${l.entry}`)).toEqual([
      `${DIALYN}:malicious-complaint`,
      `${DIALYN}:overwhelmingly-positive`,
      `${LUCIA}:wellspring-hp`,
      `${LUCIA}:nursery-rhyme`,
      `${LUCIA}:darkbreaker`,
      `${LUCIA}:darkbreaker-crit`,
    ]);
  });

  it('two chains from Dialyn: the free Ultimate and the Quick Assist (+2)', () => {
    expect(of('chain').map((l) => l.entry)).toEqual(['free-ultimate', 'get-lost-quick-assist']);
  });

  it("Lucia's Quick Assists are possible but not counted (the text doesn't say whose)", () => {
    expect(of('possible').map((l) => `${l.who}:${l.entry}`)).toEqual([`${LUCIA}:dream-quick-assist`, `${LUCIA}:ultimate-quick-assist`]);
  });

  it('team support only breaks ties: Dialyn’s own EX CRIT DMG and the extra damage from Billy’s Sheer Force', () => {
    const support = of('support').map((l) => `${l.who}:${l.entry}`);
    expect(support).toContain(`${DIALYN}:ex-crit`);
    expect(support).toContain(`${DIALYN}:previous-member-damage`);
    expect(support).toContain(`${DIALYN}:free-ultimate`);
  });

  it('locked: Billy M2, M4, M6 · Dialyn M1, M2 · Lucia M1, M2, M4, M6', () => {
    const locked = of('locked').map((l) => `${l.who}:${l.piece}`);
    for (const want of [`${BILLY}:mindscape-2`, `${BILLY}:mindscape-4`, `${BILLY}:mindscape-6`, `${DIALYN}:mindscape-1`, `${DIALYN}:mindscape-2`, `${LUCIA}:mindscape-2`, `${LUCIA}:mindscape-4`])
      expect(locked).toContain(want);
    expect(locked).not.toContain(`${BILLY}:mindscape-1`);
    expect(of('off')).toEqual([]);
  });

  it('every counted line carries its proof', () => {
    for (const l of r.lines.filter((x) => x.points !== 0 && x.kind !== 'weak-fit')) {
      expect(l.quote?.length).toBeGreaterThan(10);
      expect(l.piece).toBeTruthy();
    }
  });
});

describe('Why squad order matters', () => {
  it('Billy > Lucia > Dialyn loses the Quick Assist chain and turns off the extra damage', () => {
    const r = checkOrder([BILLY, LUCIA, DIALYN], BILLY, lib, account);
    expect(r.lines.find((l) => l.entry === 'get-lost-quick-assist')).toMatchObject({ kind: 'not-counted', points: 0 });
    expect(r.lines.find((l) => l.entry === 'previous-member-damage')).toMatchObject({ kind: 'off', points: -1 });
    expect(r.count).toBe(7);
  });

  it('the check tries both orders and keeps Billy > Dialyn > Lucia', () => {
    const out = checkSquad([LUCIA, DIALYN, BILLY], lib, account);
    expect(out.rated && out.best.order).toEqual([BILLY, DIALYN, LUCIA]);
    expect(out.rated && out.best.count).toBe(9);
  });
});

describe('Ties and order: Billy > Pan Yinhu > Lucia counts 10', () => {
  it('Pan’s M1 and M6 upgrades count as their own entries, as the method is written', () => {
    const r = checkOrder([BILLY, PAN, LUCIA], BILLY, lib, account);
    expect(r.count).toBe(10);
    expect(r.lines.filter((l) => l.who === PAN && l.kind === 'buff').map((l) => l.entry)).toEqual(['meridian-flow', 'depleted-qi', 'm1-depleted-qi', 'm6-meridian-flow']);
    expect(r.lines.filter((l) => l.kind === 'chain').map((l) => l.entry)).toEqual(['pulse-strike-quick-assist']);
  });

  it('at M0, Pan Yinhu counts 8 in the same squad', () => {
    const m0: Account = { mindscape: (id) => (id === BILLY ? 1 : 0), potential: () => undefined };
    expect(checkOrder([BILLY, PAN, LUCIA], BILLY, lib, m0).count).toBe(8);
  });

  it('Meridian Flow only reaches Billy when he stands directly before Pan Yinhu', () => {
    const r = checkOrder([BILLY, LUCIA, PAN], BILLY, lib, account);
    expect(r.lines.find((l) => l.entry === 'meridian-flow')).toMatchObject({ kind: 'not-counted' });
  });
});

describe('Part B rules', () => {
  it('a squad with an unread member is not rated', () => {
    const out = checkSquad([BILLY, DIALYN, '1011'], lib, account);
    expect(out).toMatchObject({ rated: false, unread: ['1011'] });
  });

  it('a squad with no damage dealer is not rated', () => {
    expect(checkSquad([DIALYN, LUCIA, PAN], lib, account)).toMatchObject({ rated: false });
  });

  it('weak fit: a Rupture damage dealer with a teammate who brings nothing for them', () => {
    // Pan Yinhu brings Depleted Qi for any Rupture; with Dialyn before Billy instead, check that both teammates still connect.
    const r = checkOrder([BILLY, DIALYN, PAN], BILLY, lib, account);
    expect(r.lines.filter((l) => l.kind === 'weak-fit')).toEqual([]);
  });
});

describe('Group B: the method’s other examples', () => {
  const YE = '1431';
  const SUNNA = '1491';
  const ZHAO = '1341';
  const LIGHTER = '1161';
  const ROXY = '1621';
  const HUGO = '1291';
  const LYCAON = '1141';
  const m0: Account = { mindscape: () => 0, potential: () => undefined };

  it('Ye Shunguang + Sunna + Zhao counts 9 at M0 (method: "Ye Shunguang goes from 6 to 9")', () => {
    const out = checkSquad([YE, SUNNA, ZHAO], lib, m0);
    expect(out.rated && out.best.count).toBe(9);
    // Both teammates' Ether Veils set off Ye's Additional Ability: two chains.
    expect(out.rated && out.best.lines.filter((l) => l.kind === 'chain').map((l) => l.who).sort()).toEqual([ZHAO, SUNNA].sort());
    // Zhao's +5% Max HP doesn't count: Ye's damage doesn't use Max HP.
    expect(out.rated && out.best.lines.find((l) => l.entry === 'wellspring-hp' && l.who === ZHAO)).toMatchObject({ kind: 'not-counted', points: 0 });
  });

  it('wrong attribute: Lighter’s Ice and Fire buffs on a Physical damage dealer don’t count', () => {
    const r = checkOrder([BILLY, LIGHTER, LUCIA], BILLY, lib, m0);
    expect(r.lines.find((l) => l.entry === 'ice-fire-res')).toMatchObject({ kind: 'not-counted', why: expect.stringContaining('only for ice or fire') });
    // His Elation is off: no Attack teammate and no shared faction.
    expect(r.lines.find((l) => l.entry === 'elation')).toMatchObject({ kind: 'off', points: -1 });
  });

  it('wrong specialty: Roxy’s Armorer-only buff doesn’t reach Billy, her non-Armorer one does', () => {
    const r = checkOrder([BILLY, ROXY, LUCIA], BILLY, lib, m0);
    expect(r.lines.find((l) => l.entry === 'contamination-laceration')).toMatchObject({ kind: 'not-counted' });
    expect(r.lines.find((l) => l.entry === 'contamination-crit')).toMatchObject({ kind: 'buff', points: 1 });
  });

  it('Dialyn’s and Roxy’s +2s Stun do not stack: the second is a duplicate (−1)', () => {
    const r = checkOrder([BILLY, DIALYN, ROXY], BILLY, lib, m0);
    const dup = r.lines.filter((l) => l.kind === 'duplicate');
    expect(dup).toHaveLength(1);
    expect(dup[0]).toMatchObject({ who: ROXY, entry: 'stun-duration', points: -1 });
  });

  it('a count condition: Hugo with two Stun characters switches on both ATK tiers', () => {
    const r = checkOrder([HUGO, LYCAON, LIGHTER], HUGO, lib, m0);
    expect(r.lines.filter((l) => l.kind === 'switched-on').map((l) => l.entry)).toEqual(['stun-atk', 'stun-atk-two', 'chain-totalize-dmg']);
  });

  it('Agent Potential: not saved = base kit counts, Potential pieces locked; at Potential 6 the base is replaced', () => {
    const unsaved = checkOrder([HUGO, LYCAON, ZHAO], HUGO, lib, m0);
    expect(unsaved.lines.find((l) => l.entry === 'ice-res-down')).toMatchObject({ kind: 'buff' });
    expect(unsaved.lines.find((l) => l.entry === 'p-other-attributes')).toMatchObject({ kind: 'locked', why: expect.stringContaining("Potential isn't saved yet") });
    const p6: Account = { mindscape: () => 0, potential: (id) => (id === LYCAON ? 6 : undefined) };
    const full = checkOrder([HUGO, LYCAON, ZHAO], HUGO, lib, p6);
    expect(full.lines.find((l) => l.entry === 'ice-res-down')).toMatchObject({ kind: 'replaced', points: 0 });
    expect(full.lines.find((l) => l.entry === 'p-ice-res-down')).toMatchObject({ kind: 'buff' });
    // "+30% DMG from other attributes" doesn't reach an Ice damage dealer.
    expect(full.lines.find((l) => l.entry === 'p-other-attributes')).toMatchObject({ kind: 'not-counted' });
  });
});

describe('Group C', () => {
  const SEED = '1461';
  const CISSIA = '1521';
  const SUNNA = '1491';
  const BANYUE = '1471';
  const m0: Account = { mindscape: () => 0, potential: () => undefined };
  const owner: Account = { mindscape: (id) => ({ [BILLY]: 1, [PAN]: 6 })[id] ?? 0, potential: () => undefined };

  it("a damage dealer's ability that goes to a teammate is not 'theirs switched on' (Seed's Vanguard buff)", () => {
    const asSeed = checkOrder([SEED, CISSIA, SUNNA], SEED, lib, m0);
    expect(asSeed.lines.find((l) => l.who === SEED && l.entry === 'direct-strike')).toMatchObject({ kind: 'not-counted', points: 0 });
    const asCissia = checkOrder([CISSIA, SEED, SUNNA], CISSIA, lib, m0);
    expect(asCissia.lines.find((l) => l.who === SEED && l.entry === 'direct-strike')).toMatchObject({ kind: 'buff', points: 1 });
  });

  it('the method’s example: Banyue > Pan Yinhu > Lucia counts 9', () => {
    expect(checkOrder([BANYUE, PAN, LUCIA], BANYUE, lib, owner).count).toBe(9);
  });
});

describe('Group E: Anomaly DMG is a stat only some damage dealers use', () => {
  const PIPER = '1281';
  const JANE = '1261';
  const m0: Account = { mindscape: () => 0, potential: () => undefined };

  it("Jane's Assault CRIT doesn't count for Starlight Billy (his damage is Sheer DMG), but does for Piper", () => {
    const billy = checkOrder([BILLY, PIPER, JANE], BILLY, lib, m0);
    expect(billy.lines.find((l) => l.entry === 'gnawed-assault-crit')).toMatchObject({ kind: 'not-counted', points: 0 });
    const piper = checkOrder([PIPER, JANE, LUCIA], PIPER, lib, m0);
    expect(piper.lines.find((l) => l.entry === 'gnawed-assault-crit')).toMatchObject({ kind: 'buff', points: 1 });
  });
});
