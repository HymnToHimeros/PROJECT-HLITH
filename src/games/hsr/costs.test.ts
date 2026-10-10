// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { materialsFor, skillsOf } from './costs';
import materials from './data/materials.json';

const amount = (needs: { material: string; amount: number }[], id: string) => needs.find((n) => n.material === id)?.amount ?? 0;
const ROBIN = '1309';

describe('HSR materials (nanoka.cc level-up costs)', () => {
  it('ascension 1 → 80: Dream Collection Components and Credits from the game data', () => {
    const none = skillsOf(ROBIN).map(() => 0);
    const needs = materialsFor(ROBIN, { level: 1, skills: none }, { level: 80, skills: none });
    expect(amount(needs, '114001')).toBe(15); // 5 at 20, 10 at 30
    expect(amount(needs, '2')).toBe(4000 + 8000 + 16000 + 40000 + 80000 + 160000);
  });

  it('Traces count from not unlocked (0) to unlocked (1)', () => {
    const traces = skillsOf(ROBIN).filter((s) => s.max === 1);
    expect(traces.length).toBeGreaterThan(5);
  });

  it('every material it names is in the material list', () => {
    const ids = new Set(materials.map((m) => m.id));
    for (const n of materialsFor(ROBIN, { level: 1 }, { level: 80 })) expect(ids.has(n.material), n.material).toBe(true);
  });

  it("character EXP 1 → 80 from the game's own table: 5,797,920 EXP = 290 Traveler's Guides", () => {
    const none = skillsOf(ROBIN).map(() => 0);
    const needs = materialsFor(ROBIN, { level: 1, skills: none }, { level: 80, skills: none });
    expect(amount(needs, '213')).toBe(Math.ceil(5_797_920 / 20_000));
    expect(materials.find((m) => m.id === '213')?.name).toBe("Traveler's Guide");
  });
});
