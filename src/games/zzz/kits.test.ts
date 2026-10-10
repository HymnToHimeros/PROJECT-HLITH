// @vitest-environment node
import { describe, expect, it } from 'vitest';
import characters from './data/characters.json';
import kits from './data/kits.json';
import profiles from './data/profiles.json';

const ids = new Set(characters.map((c) => c.id));
const kitOf = (id: string) => kits.find((k) => k.characterId === id);
const piece = (id: string, piece: string) => kitOf(id)?.skills.find((s) => s.id === piece)?.gameText ?? '';

describe('ZZZ profiles (docs/logic/zzz-method.md: every character needs one)', () => {
  it('every character has exactly one profile, and it matches the character list', () => {
    expect(profiles.map((p) => p.characterId).sort()).toEqual([...ids].sort());
    for (const p of profiles) {
      const c = characters.find((x) => x.id === p.characterId);
      expect(p.specialty, p.characterId).toBe(c?.role);
      expect(p.attribute, p.characterId).toBe(c?.element);
      expect(p.faction.length, p.characterId).toBeGreaterThan(0);
      expect(['defensive', 'evasive']).toContain(p.assistType);
    }
  });

  it('reads factions from the game (Dialyn is Krampus Compliance Authority)', () => {
    expect(profiles.find((p) => p.characterId === '1481')).toMatchObject({ specialty: 'stun', attribute: 'physical', faction: 'Krampus Compliance Authority' });
  });
});

describe('ZZZ kit text', () => {
  it('groups A to G are in, and no one else (group by group, never all at once)', () => {
    const groupA = ['1421', '1451', '1481', '1531']; // Pan Yinhu, Lucia, Dialyn, Starlight Billy
    const groupB = ['1141', '1161', '1291', '1341', '1431', '1491', '1621']; // Lycaon, Lighter, Hugo, Zhao, Ye Shunguang, Sunna, Roxy
    const groupC = ['1111', '1151', '1201', '1211', '1461', '1471', '1521', '1571']; // Anton, Lucy, Harumasa, Rina, Seed, Banyue, Cissia, Norma
    const groupD = ['1051', '1311', '1371', '1391', '1411', '1441', '1611']; // Yidhari, Astra Yao, Yixuan, Ju Fufu, Yuzuha, Manato, Claret
    const groupE = ['1091', '1171', '1221', '1261', '1281', '1331', '1401']; // Miyabi, Burnice, Yanagi, Jane, Piper, Vivian, Alice
    const groupF = ['1181', '1351', '1501', '1511', '1541', '1561', '1581']; // Grace, Pulchra, Aria, Nangong Yu, Promeia, Velina, Remielle
    const groupG = ['1031', '1131', '1191', '1241', '1251', '1271', '1321']; // Nicole, Soukaku, Ellen, Zhu Yuan, Qingyi, Seth, Evelyn
    expect(kits.map((k) => k.characterId).sort()).toEqual([...groupA, ...groupB, ...groupC, ...groupD, ...groupE, ...groupF, ...groupG].sort());
  });

  it('released agents are read from the live version, not beta text', () => {
    for (const k of kits as { characterId: string; version: string; beta?: boolean }[]) if (!k.beta) expect(k.version, k.characterId).not.toContain('+');
  });

  it.each(kits.map((k) => [k.characterId, k] as const))('%s: known character, every part present, unique ids, no markup left', (id, kit) => {
    expect(ids.has(id)).toBe(true);
    expect(kit.source).toBe('nanoka.cc');
    const pieceIds = kit.skills.map((s) => s.id);
    expect(new Set(pieceIds).size).toBe(pieceIds.length);
    expect(pieceIds.some((p) => p.startsWith('core-passive'))).toBe(true);
    expect(pieceIds.some((p) => p.startsWith('additional-ability'))).toBe(true);
    for (const want of ['mindscape-1', 'mindscape-2', 'mindscape-3', 'mindscape-4', 'mindscape-5', 'mindscape-6']) expect(pieceIds).toContain(want);
    expect(kit.skills.filter((s) => s.kind === 'skill').length).toBeGreaterThan(5);
    for (const s of kit.skills) {
      expect(s.gameText.length, s.id).toBeGreaterThan(10);
      expect(s.gameText, s.id).not.toMatch(/<[^>]+>|\{[^}]*\}/);
    }
    for (let m = 1; m <= 6; m++) expect(kit.skills.find((s) => s.id === `mindscape-${m}`)?.unlock).toEqual({ dupes: m });
  });

  it('holds the exact sentences the method quotes', () => {
    expect(piece('1481', 'additional-ability')).toContain(
      'When an EX Special Attack or Ultimate is activated, all squad members gain the Overwhelmingly Positive effect. While Overwhelmingly Positive is active, DMG dealt is increased by 40% for 15s.',
    );
    expect(piece('1481', 'skill-ex-special-attack-get-lost')).toContain("the previous character's Quick Assist is triggered");
    expect(piece('1421', 'skill-ex-special-attack-mountainous-pulse-strike')).toContain('triggers the Quick Assist of the previous character in the squad');
    expect(piece('1421', 'core-passive')).toContain("Sheer Force boost equal to 18% of Pan Yinhu's initial ATK and lasts for 25s");
    expect(piece('1531', 'additional-ability')).toContain('When another character in your squad is a Stun, Defense, or Support character');
    expect(piece('1531', 'core-passive')).toContain('All Physical DMG Starlight - Billy deals is Sheer DMG, ignoring enemy DEF');
  });

  it('turns level formulas into the game’s own sum', () => {
    expect(piece('1451', 'skill-ex-special-attack-symphony-of-the-reaper-daybreak')).toContain('an additional (34 + 3 × Special Attack level)% of her Max HP');
  });
});
