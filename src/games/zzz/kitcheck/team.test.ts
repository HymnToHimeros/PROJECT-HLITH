// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { TeamAccount } from '../../../core/contract';
import { ifYouPull, lineUps, synergyLabel, verdict, whoFits } from './team';

const BILLY = '1531';
const DIALYN = '1481';
const LUCIA = '1451';
const PAN = '1421';

const account = (owned: string[], dupes: Record<string, number> = { [BILLY]: 1, [PAN]: 6 }): TeamAccount => ({
  owned: (id) => owned.includes(id),
  dupes: (id) => dupes[id] ?? 0,
});
const all = account([BILLY, DIALYN, LUCIA, PAN]);

describe('Synergy % on presets', () => {
  it('the method’s example: Billy > Dialyn > Lucia counts 9 against Billy > Pan Yinhu > Lucia at 10 = 90%, Excellent', () => {
    const v = verdict([BILLY, DIALYN, LUCIA], all);
    expect(v).toMatchObject({ rated: true, count: 9, best: 10, percent: 90, label: 'Excellent', order: [BILLY, DIALYN, LUCIA], bestMembers: [BILLY, PAN, LUCIA] });
  });

  it('100% when the check knows no better squad', () => {
    expect(verdict([BILLY, PAN, LUCIA], all)).toMatchObject({ rated: true, percent: 100 });
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
    expect(verdict([BILLY, DIALYN, '1011'], all)).toMatchObject({ rated: false });
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
    const fits = whoFits([BILLY], all);
    expect(fits.map((f) => f.id).sort()).toEqual([DIALYN, LUCIA, PAN].sort());
    const dialyn = fits.find((f) => f.id === DIALYN);
    expect(dialyn?.how.join(' | ')).toContain("turns on Starlight - Billy's Additional Ability: Blazing Starlight");
  });

  it('for Billy and Dialyn: Pan Yinhu and Lucia both connect', () => {
    expect(whoFits([BILLY, DIALYN], all).map((f) => f.id).sort()).toEqual([LUCIA, PAN].sort());
  });
});

describe('If you pull…', () => {
  it('as a teammate: without Pan Yinhu, Billy’s best is 9; with him 10 of 10 = 100%', () => {
    const v = ifYouPull(PAN, account([BILLY, DIALYN, LUCIA], { [BILLY]: 1 }));
    // Tested at M0: Pan Yinhu gives 8 with Lucia, so no lift over Dialyn's 9.
    expect(v).toMatchObject({ percent: 0 });
    const owner = ifYouPull(LUCIA, account([BILLY, DIALYN, PAN], { [BILLY]: 1, [PAN]: 6 }));
    expect(owner?.percent).toBe(100);
    expect(owner?.why.join(' ')).toContain('As a teammate: Starlight - Billy goes from');
  });

  it('as a damage dealer: Billy with your agents against every agent', () => {
    const v = ifYouPull(BILLY, account([DIALYN, LUCIA, PAN], { [PAN]: 6 }));
    expect(v?.percent).toBe(100);
    expect(v?.why[0]).toContain('As a damage dealer');
  });

  it('unread agents are not rated', () => {
    expect(ifYouPull('1011', all)).toBeNull();
  });
});
