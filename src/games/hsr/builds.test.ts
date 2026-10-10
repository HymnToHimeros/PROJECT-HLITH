// @vitest-environment node
import { describe, expect, it } from 'vitest';
import builds from './data/builds.json';
import characters from './data/characters.json';
import teams from './data/teams.json';

const ids = new Set(characters.map((c) => c.id));

describe("HSR recommended builds and teams (the game's own recommendation)", () => {
  it('every build is for a known character and names its source', () => {
    for (const b of builds) {
      expect(ids.has(b.characterId), b.characterId).toBe(true);
      expect(b.source).toContain("the game's own recommendation");
    }
  });

  it('Robin: relic sets, Light Cones and Link Rope from the game', () => {
    const r = builds.find((b) => b.characterId === '1309');
    expect(r?.weapons[0]).toBe('Flowing Nightglow');
    expect((r?.mainStats as Record<string, string[]>)['Link Rope']).toEqual(['Energy Regeneration Rate']);
  });

  it('recommended teams use known characters, the lead first, ids never repeat', () => {
    expect(new Set(teams.map((t) => t.id)).size).toBe(teams.length);
    for (const t of teams) {
      for (const s of t.slots) for (const c of s.characters) expect(ids.has(c), `${t.id}: ${c}`).toBe(true);
      expect(t.source).toContain("the game's own recommended team");
    }
  });
});
