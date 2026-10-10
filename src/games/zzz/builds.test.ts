// @vitest-environment node
import { describe, expect, it } from 'vitest';
import builds from './data/builds.json';
import characters from './data/characters.json';

describe("ZZZ recommended builds (the game's own recommendation)", () => {
  it('every build is for a known agent, names its source, and has a 4-piece set', () => {
    const ids = new Set(characters.map((c) => c.id));
    for (const b of builds) {
      expect(ids.has(b.characterId), b.characterId).toBe(true);
      expect(b.source).toContain("the game's own recommendation");
      expect(b.sets.find((s) => s.pieces === 4)?.options.length).toBe(1);
    }
  });

  it("Dialyn: King of the Summit, her own W-Engine, and the game's skill order", () => {
    const d = builds.find((b) => b.characterId === '1481');
    expect(d?.sets[0]?.options).toEqual(['King of the Summit']);
    expect(d?.weapons).toEqual(['Yesterday Calls']);
    expect(d?.mainStats).toEqual({ 'Disc 4': ['CRIT Rate'], 'Disc 5': ['Energy Regen'], 'Disc 6': ['Impact'] });
    expect(d?.skillsFirst[0]).toEqual(['Core Skill', 'Special Attack']);
  });

  it('every Drive Disc set and W-Engine named has its picture and game text', () => {
    for (const b of builds) {
      const items = (b as { items?: Record<string, { icon?: string; effects: { label: string; text: string }[] }> }).items ?? {};
      for (const name of [...b.sets.flatMap((s) => s.options), ...b.weapons]) {
        const it = items[name];
        expect(it?.icon, `${b.characterId}: ${name} picture`).toMatch(/^https:\/\/static\.nanoka\.cc\/assets\/zzz\/.+\.webp$/);
        expect(it?.effects.length, `${b.characterId}: ${name} effects`).toBeGreaterThan(0);
      }
    }
    const d = builds.find((b) => b.characterId === '1481') as { items: Record<string, { effects: { label: string; text: string }[] }> } | undefined;
    expect(d?.items['King of the Summit']?.effects.map((e) => e.label)).toEqual(['2-piece', '4-piece']);
  });
});
