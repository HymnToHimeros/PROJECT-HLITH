import { describe, expect, it } from 'vitest';
import type { TeamAccount } from '../../../core/contract';
import { checkSquad, checkTeam, type Account, type Line } from './check';
import { KITS, SHEETS, library } from './library';
import characters from '../data/characters.json';
import { endfieldTeamRules, readSoFar, recommendedTeams, synergyLabel } from './team';

const CHEN = 'chr_0005_chen';
const DA_PAN = 'chr_0018_dapan';
const CATCHER = 'chr_0020_meurs';
const ANTAL = 'chr_0023_antal';
const ENDMIN = 'chr_0002_endminm';
const LIFENG = 'chr_0015_lifeng';
const LAEVATAIN = 'chr_0016_laevat';
const AKEKURI = 'chr_0019_karin';
const WULFGARD = 'chr_0006_wolfgd';
const ARDELIA = 'chr_0025_ardelia';
const GILBERTA = 'chr_0013_aglina';
const LAST_RITE = 'chr_0026_lastrite';
const SI = 'chr_0036_jsspsi';
const TYPHOEUS = 'chr_0034_typhoea';
const LIINO = 'chr_0035_liino';
const ARCANE = 'chr_0032_lizhiyan';
const MI_FU = 'chr_0031_mifu';
const TANGTANG = 'chr_0027_tangtang';
const ZHUANG = 'chr_0030_zhuangfy';
const ARCLIGHT = 'chr_0007_ikut';
const ESTELLA = 'chr_0021_whiten';
const SNOWSHINE = 'chr_0014_aurora';
const ALESH = 'chr_0024_deepfin';
const PURRCHENA = 'chr_0038_purrche';
const ROSSI = 'chr_0028_wulfa';

const p0: Account = { potential: () => 0 };
const lib = library();
const linesOf = (lines: Line[], who: string, kind?: Line['kind']) => lines.filter((l) => l.who === who && (!kind || l.kind === kind));

describe('Endfield sheets (Part A step 6)', () => {
  it.each(SHEETS.map((s) => [s.name, s] as const))('%s: every quote is word for word, every kit piece is read', (_name, s) => {
    const kit = KITS.find((k) => k.characterId === s.characterId);
    expect(kit).toBeDefined();
    const text = new Map(kit?.skills.map((x) => [x.id, x.gameText]));
    for (const e of s.entries) {
      expect(text.has(e.piece), `${e.id}: no piece ${e.piece}`).toBe(true);
      expect(text.get(e.piece), `${e.id}: quote not in ${e.piece}`).toContain(e.quote);
      expect(e.setup.trim(), `${e.id}: no setup`).not.toBe('');
    }
    for (const q of s.damage?.quotes ?? []) expect(text.get(q.piece), `damage quote not in ${q.piece}`).toContain(q.quote);
    const read = new Set([...s.entries.map((e) => e.piece), ...Object.keys(s.nothing)]);
    expect([...text.keys()].filter((id) => !read.has(id)), 'pieces not read').toEqual([]);
    expect(Object.keys(s.nothing).filter((id) => !text.has(id)), 'unknown pieces in nothing').toEqual([]);
    expect(new Set(s.entries.map((e) => e.id)).size).toBe(s.entries.length);
  });
});

describe('Endfield check (Part B)', () => {
  it('a chain: Catcher makes the enemy Vulnerable, which triggers Chen Qianyu’s combo', () => {
    const r = checkTeam([CHEN, CATCHER], CHEN, lib, p0);
    const chain = linesOf(r.lines, CATCHER, 'chain');
    expect(chain.map((l) => l.why)).toContain('sets up Vulnerable for Chen Qianyu: Combo when an enemy becomes Vulnerable');
    expect(chain[0]?.points).toBe(1);
  });
  it('Physical Status setups feed Da Pan’s 4-stack combo; his own pieces don’t count as chains', () => {
    const r = checkTeam([DA_PAN, CHEN], DA_PAN, lib, p0);
    expect(linesOf(r.lines, CHEN, 'chain').length).toBeGreaterThan(0);
    expect(linesOf(r.lines, DA_PAN, 'chain')).toEqual([]);
  });
  it('a Physical buff reaches a Physical damage dealer; Antal’s Electric and Heat Amp doesn’t', () => {
    const r = checkTeam([ENDMIN, LIFENG, ANTAL], ENDMIN, lib, p0);
    expect(linesOf(r.lines, LIFENG, 'buff').map((l) => l.tag)).toContain('Physical Susceptibility 12%');
    const amp = linesOf(r.lines, ANTAL).find((l) => l.entry === 'amp');
    expect(amp).toMatchObject({ kind: 'not-counted', points: 0 });
    expect(amp?.why).toMatch(/only for Electric or Heat DMG/);
  });
  it('a Knock Down shatters the Endministrator’s crystals: a chain', () => {
    const r = checkTeam([ENDMIN, LIFENG], ENDMIN, lib, p0);
    expect(linesOf(r.lines, LIFENG, 'chain').map((l) => l.why)).toContain('sets up Knock Down for Endministrator (Male): Crystals shattered by a Physical Status');
  });
  it('Potentials are locked at Potential 0 and count once saved', () => {
    const locked = checkTeam([ENDMIN, LIFENG], ENDMIN, lib, p0);
    expect(linesOf(locked.lines, LIFENG).find((l) => l.entry === 'p1-susceptibility')).toMatchObject({ kind: 'locked', points: 0 });
    const p1 = checkTeam([ENDMIN, LIFENG], ENDMIN, lib, { potential: (id) => (id === LIFENG ? 1 : 0) });
    expect(linesOf(p1.lines, LIFENG).find((l) => l.entry === 'p1-susceptibility')).toMatchObject({ kind: 'buff', points: 1 });
  });
  it('team support only breaks ties; a teammate with only support is not a weak fit', () => {
    const r = checkTeam([CHEN, ANTAL], CHEN, lib, p0);
    expect(linesOf(r.lines, ANTAL, 'support').length).toBeGreaterThan(0);
    expect(linesOf(r.lines, ANTAL, 'weak-fit')).toEqual([]);
  });
  it('the two Endministrators are one operator: never in a team together', () => {
    expect(checkSquad([ENDMIN, 'chr_0003_endminf', LIFENG], lib, p0)).toMatchObject({ rated: false });
    for (const t of recommendedTeams()) expect(t.slots.flatMap((s) => s.characters).filter((id) => id.startsWith('chr_000') && /endmin/.test(id)).length).toBeLessThanOrEqual(1);
  });
  it('Susceptibility needs its element: Antal’s Electric and Heat Susceptibility doesn’t trigger Lifeng’s Physical one', () => {
    const r = checkTeam([LIFENG, ANTAL], LIFENG, lib, p0);
    expect(linesOf(r.lines, ANTAL, 'chain')).toEqual([]);
  });
  it('every damage dealer in the team is tried; an unread operator says so', () => {
    const out = checkSquad([CHEN, DA_PAN, CATCHER], lib, p0);
    expect(out.rated).toBe(true);
    if (out.rated) expect([CHEN, DA_PAN]).toContain(out.best.dd);
    const unread = checkSquad([CHEN, 'chr_argent-flow'], lib, p0);
    expect(unread).toMatchObject({ rated: false, unread: ['chr_argent-flow'] });
  });
});

describe('Endfield check, group B (Heat, Cryo, Nature)', () => {
  it('a forced Combustion or Corrosion triggers Laevatain’s combo; Heat Infliction feeds her Melting Flame', () => {
    const r = checkTeam([LAEVATAIN, WULFGARD, ARDELIA, AKEKURI], LAEVATAIN, lib, p0);
    expect(linesOf(r.lines, WULFGARD, 'chain').map((l) => l.why)).toContain('sets up Combustion for Laevatain: Combo on Combustion or Corrosion');
    expect(linesOf(r.lines, ARDELIA, 'chain').map((l) => l.why)).toContain('sets up Corrosion for Laevatain: Combo on Combustion or Corrosion');
    expect(linesOf(r.lines, AKEKURI, 'chain').length).toBeGreaterThan(0);
    // Ardelia's Arts Susceptibility reaches a Heat damage dealer.
    expect(linesOf(r.lines, ARDELIA, 'buff').map((l) => l.tag)).toContain('Physical and Arts Susceptibility 20%');
  });
  it('decision 5: one element’s Infliction on top of another’s sets up the reaction of the second', () => {
    // Gilberta's Nature Infliction on Laevatain's Heat makes Corrosion.
    const r = checkTeam([LAEVATAIN, GILBERTA], LAEVATAIN, lib, p0);
    expect(linesOf(r.lines, GILBERTA, 'chain').map((l) => l.why)).toContain('sets up Corrosion (on another element’s Infliction) for Laevatain: Combo on Combustion or Corrosion');
    // Only one element in the team: no reaction.
    const heatOnly = checkTeam([WULFGARD, AKEKURI], WULFGARD, lib, p0);
    expect(linesOf(heatOnly.lines, AKEKURI, 'chain').map((l) => l.why).join(' ')).not.toMatch(/Combustion|Electrification/);
  });
  it('element limits: Antal’s Heat Amp reaches Laevatain; Last Rite’s Cryo Susceptibility doesn’t', () => {
    const r = checkTeam([LAEVATAIN, ANTAL, LAST_RITE], LAEVATAIN, lib, p0);
    expect(linesOf(r.lines, ANTAL, 'buff').map((l) => l.tag)).toContain('Electric and Heat Amp 20%');
    expect(linesOf(r.lines, LAST_RITE).find((l) => l.entry === 'cryo-susceptibility')).toMatchObject({ kind: 'not-counted', points: 0 });
  });
});

describe('Endfield check, group C', () => {
  it('decision 8: Si applies Heat Infliction when a Heat operator leads (Team Position 01 = the damage dealer), else Cryo; the other one is no loss', () => {
    const heat = checkTeam([LAEVATAIN, SI], LAEVATAIN, lib, p0);
    expect(linesOf(heat.lines, SI, 'chain').map((l) => l.why)).toContain('sets up Heat Infliction for Laevatain: Melting Flame from Heat Infliction');
    expect(linesOf(heat.lines, SI).find((l) => l.entry === 'cryo-infliction')).toMatchObject({ kind: 'not-counted', points: 0 });
    expect(linesOf(heat.lines, SI, 'buff').map((l) => l.tag)).toContain('Cryo and Heat Amp 36%');
    const cryo = checkTeam([LAST_RITE, SI], LAST_RITE, lib, p0);
    expect(linesOf(cryo.lines, SI, 'chain').map((l) => l.why)).toContain('sets up Cryo Infliction for Last Rite: Combo at 3 Cryo Infliction stacks');
    expect(linesOf(cryo.lines, SI).find((l) => l.entry === 'heat-infliction')).toMatchObject({ kind: 'not-counted', points: 0 });
  });
  it('Arcane’s mode depends on her build: INT- and WILL-only effects are shown, never counted', () => {
    const r = checkTeam([TYPHOEUS, ARCANE], TYPHOEUS, lib, p0);
    for (const id of ['will-infliction', 'int-corrosion', 'will-susceptibility']) expect(linesOf(r.lines, ARCANE).find((l) => l.entry === id)).toMatchObject({ kind: 'unknown', points: 0 });
    // What both modes do counts: Nature Infliction feeds Typhoeus.
    expect(linesOf(r.lines, ARCANE, 'chain').map((l) => l.why)).toContain('sets up Nature Infliction for Typhoeus: Signs from Nature Infliction');
  });
  it('Liino’s Electric and Nature Amp reaches Typhoeus, not Tangtang; her two stances’ ATK Boost counts once, with no loss', () => {
    const nature = checkTeam([TYPHOEUS, LIINO], TYPHOEUS, lib, { potential: () => 0 });
    expect(linesOf(nature.lines, LIINO, 'buff').map((l) => l.tag)).toContain('Electric and Nature Amp (grows with Will)');
    expect(linesOf(nature.lines, LIINO, 'buff').filter((l) => l.tag === 'Team ATK +10%')).toHaveLength(1);
    expect(linesOf(nature.lines, LIINO, 'duplicate')).toEqual([]);
    const cryo = checkTeam([TANGTANG, LIINO], TANGTANG, lib, p0);
    expect(linesOf(cryo.lines, LIINO).find((l) => l.entry === 'cosmovoice-amp')).toMatchObject({ kind: 'not-counted', points: 0 });
  });
  it('Mi Fu: Physical Statuses build her 3 Vulnerable stacks; Lifeng’s Physical Susceptibility powers World Splitter', () => {
    const r = checkTeam([MI_FU, LIFENG, CHEN], MI_FU, lib, p0);
    expect(linesOf(r.lines, LIFENG, 'chain').length).toBeGreaterThan(0);
    expect(linesOf(r.lines, CHEN, 'chain').map((l) => l.why)).toContain('sets up Vulnerable for Mi Fu: World Splitter at 3 Vulnerable stacks');
  });
});

describe('Endfield check, groups D and E', () => {
  it('Arclight’s forced Electrification powers Zhuang Fangyi’s Battle Skill', () => {
    const r = checkTeam([ZHUANG, ARCLIGHT], ZHUANG, lib, p0);
    expect(linesOf(r.lines, ARCLIGHT, 'chain').map((l) => l.why)).toContain('sets up Electrification for Zhuang Fangyi: Stronger on Electrification');
  });
  it('a forced Solidification triggers Estella’s combo (Snowshine’s Snow Zone, Alesh’s Battle Skill)', () => {
    const r = checkTeam([ESTELLA, SNOWSHINE, ALESH], ESTELLA, lib, p0);
    for (const who of [SNOWSHINE, ALESH]) expect(linesOf(r.lines, who, 'chain').map((l) => l.why)).toContain('sets up Solidification for Estella: Combo on Solidification');
  });
  it('Rossi’s combo needs Vulnerable and an Arts Infliction: either can come from a teammate', () => {
    const r = checkTeam([ROSSI, CHEN, AKEKURI], ROSSI, lib, p0);
    expect(linesOf(r.lines, CHEN, 'chain').length).toBeGreaterThan(0);
    expect(linesOf(r.lines, AKEKURI, 'chain').map((l) => l.why)).toContain('sets up Heat Infliction for Rossi: Combo on Vulnerable and an Arts Infliction');
  });
  it('decision 11: effects that need luck are shown, never counted', () => {
    const r = checkTeam([TYPHOEUS, PURRCHENA, ALESH], TYPHOEUS, lib, { potential: () => 5 });
    expect(linesOf(r.lines, PURRCHENA).find((l) => l.entry === 'ambassador')).toMatchObject({ kind: 'unknown', points: 0 });
    expect(linesOf(r.lines, ALESH).find((l) => l.entry === 'p3-team-atk')).toMatchObject({ kind: 'unknown', points: 0 });
  });
});

describe('Endfield team rules', () => {
  const all: TeamAccount = { owned: () => true, dupes: () => 0 };
  it('scores a team of four and says how it compares', () => {
    const v = endfieldTeamRules.verdict([CHEN, CATCHER, LIFENG, DA_PAN], all);
    expect(v.rated).toBe(true);
    if (v.rated) {
      expect(v.percent).toBeGreaterThan(0);
      expect(v.percent).toBeLessThanOrEqual(100);
      expect(v.reasons.some((r) => r.group === 'counted' && r.proof?.quote)).toBe(true);
    }
  });
  it('while only some kits are read: the counts come from the data, and no grade word (the % stays)', () => {
    expect(endfieldTeamRules.readSoFar?.()).toEqual({ read: SHEETS.length, total: characters.length });
    expect(SHEETS.length).toBeLessThan(characters.length);
    const v = endfieldTeamRules.verdict([CHEN, CATCHER, LIFENG, DA_PAN], all);
    expect(v).toMatchObject({ rated: true, label: '' });
    if (v.rated) expect(v.notes).toContain(`Only ${SHEETS.length} of ${characters.length} operators are read so far: this is the best among those, and it will change as more are read.`);
    expect(synergyLabel(100, 4, true)).toBe('');
    expect(synergyLabel(100, 4)).toBe('Excellent');
    expect(synergyLabel(100, 3, true)).toBe('Incomplete');
    expect(readSoFar({ ...lib, names: new Map([...lib.sheets.keys()].map((id) => [id, id])) })).toEqual({ read: SHEETS.length, total: SHEETS.length });
  });
  it('recommends a team for every damage dealer read', () => {
    const teams = recommendedTeams();
    expect(teams.map((t) => t.slots[0]?.characters[0]).sort()).toEqual(SHEETS.filter((s) => s.damage).map((s) => s.characterId).sort());
    for (const t of teams) expect(t.slots.length).toBeLessThanOrEqual(4);
  });
});
