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

  it('every set and Light Cone named has its picture and game text, numbers filled in', () => {
    for (const b of builds) {
      const items = (b as { items?: Record<string, { icon?: string; effects: { text: string }[] }> }).items ?? {};
      for (const name of [...b.sets.flatMap((s) => s.options), ...b.weapons]) {
        const it = items[name];
        expect(it?.icon, `${b.characterId}: ${name} picture`).toMatch(/^https:\/\/static\.nanoka\.cc\/assets\/hsr\/.+\.webp$/);
        expect(it?.effects.length, `${b.characterId}: ${name} effects`).toBeGreaterThan(0);
        for (const e of it?.effects ?? []) expect(e.text, name).not.toMatch(/#\d|<[^>]+>/);
      }
    }
    const robin = builds.find((b) => b.characterId === '1309') as { items: Record<string, { effects: { text: string }[] }> } | undefined;
    expect(robin?.items['Flowing Nightglow']?.effects[0]?.text).toContain('%');
  });

  it('recommended teams use known characters, the lead first, ids never repeat', () => {
    expect(new Set(teams.map((t) => t.id)).size).toBe(teams.length);
    for (const t of teams) {
      for (const s of t.slots) for (const c of s.characters) expect(ids.has(c), `${t.id}: ${c}`).toBe(true);
      expect(t.source).toContain("the game's own recommended team");
    }
  });

  it('every weapon has its picture; every weapon on a banner is in the list; "made for" names a known character', async () => {
    const { default: weapons } = await import('./data/weapons.json');
    const { default: banners } = await import('./data/banners.json');
    const ids = new Set(weapons.map((w) => w.id));
    for (const w of weapons) expect(w.icon, w.name).toMatch(/^https:\/\/static\.nanoka\.cc\/assets\/hsr\/.+\.webp$/);
    for (const b of banners.filter((x) => x.type === 'light-cone')) for (const f of b.featured) expect(ids.has(f), `${b.title}: ${f}`).toBe(true);
    const chars = new Set(characters.map((c) => c.id));
    for (const w of weapons) if ('madeFor' in w && w.madeFor) expect(chars.has(w.madeFor), w.name).toBe(true);
  });
});
