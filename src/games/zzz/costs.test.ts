// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { materialsFor, skillsOf } from './costs';
import materials from './data/materials.json';

const amount = (needs: { material: string; amount: number }[], id: string) => needs.find((n) => n.material === id)?.amount ?? 0;
const DIALYN = '1481';

describe('ZZZ materials (nanoka.cc level-up costs)', () => {
  it('level 1 → 60 needs 900,000 EXP = 300 Senior Investigator Logs (as Icy Veins lists)', () => {
    expect(amount(materialsFor(DIALYN, { level: 1, skills: [1, 1, 1, 1, 1, 1] }, { level: 60, skills: [1, 1, 1, 1, 1, 1] }), '300003')).toBe(300);
  });

  it('ascension: Stun Certification Seals at each cap, nothing past 60', () => {
    const needs = materialsFor(DIALYN, { level: 1, skills: [1, 1, 1, 1, 1, 1] }, { level: 60, skills: [1, 1, 1, 1, 1, 1] });
    expect(amount(needs, '100212')).toBe(4); // Basic Stun Certification Seal, at level 10
    expect(amount(needs, '100222')).toBe(32); // Advanced: 12 at 20, 20 at 30
    expect(materialsFor(DIALYN, { level: 60 }, { level: 90, skills: [] })).toEqual(materialsFor(DIALYN, { level: 60 }, { level: 60, skills: [] }));
  });

  it('five skills to 12 and the Core Skill to 7, each counted once', () => {
    expect(skillsOf(DIALYN).map((s) => `${s.label} ${s.max}`)).toEqual(['Basic Attack 12', 'Dodge 12', 'Assist 12', 'Special Attack 12', 'Chain Attack 12', 'Core Skill 7']);
    const one = materialsFor(DIALYN, { level: 60, skills: [1, 12, 12, 12, 12, 7] }, { level: 60, skills: [12, 12, 12, 12, 12, 7] });
    const all = materialsFor(DIALYN, { level: 60, skills: [1, 1, 1, 1, 1, 7] }, { level: 60, skills: [12, 12, 12, 12, 12, 7] });
    expect(amount(all, '10')).toBe(5 * amount(one, '10'));
  });

  it('every material it names is in the material list', () => {
    const ids = new Set(materials.map((m) => m.id));
    for (const n of materialsFor(DIALYN, { level: 1 }, { level: 60 })) expect(ids.has(n.material), n.material).toBe(true);
  });

  it('an agent not in the data needs nothing listed (the screen says "No data yet")', () => {
    expect(materialsFor('1631', { level: 1 }, { level: 60 })).toEqual([]);
  });
});
