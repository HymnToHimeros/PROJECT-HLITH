import { describe, expect, it } from 'vitest';
import type { TeamAccount } from '../../../core/contract';
import { checkSquad, checkTeam, type Account, type Line } from './check';
import { KITS, SHEETS, library } from './library';
import { endfieldTeamRules, recommendedTeams } from './team';

const CHEN = 'chr_0005_chen';
const DA_PAN = 'chr_0018_dapan';
const CATCHER = 'chr_0020_meurs';
const ANTAL = 'chr_0023_antal';
const ENDMIN = 'chr_0002_endminm';
const LIFENG = 'chr_0015_lifeng';

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
    const unread = checkSquad([CHEN, 'chr_0016_laevat'], lib, p0);
    expect(unread).toMatchObject({ rated: false, unread: ['chr_0016_laevat'] });
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
  it('recommends a team for every damage dealer read', () => {
    const teams = recommendedTeams();
    expect(teams.map((t) => t.slots[0]?.characters[0]).sort()).toEqual(SHEETS.filter((s) => s.damage).map((s) => s.characterId).sort());
    for (const t of teams) expect(t.slots.length).toBeLessThanOrEqual(4);
  });
});
