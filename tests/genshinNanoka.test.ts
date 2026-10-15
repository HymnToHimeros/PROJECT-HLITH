import { describe, expect, it } from 'vitest';
import { genshin, genshinWeapons } from '../scripts/nanoka/genshin.ts';

// Rows as nanoka.cc's gi character.json / weapon.json give them.
const CHARS = {
  '10000002': { release: '2021-07-21 00:00:00', icon: 'UI_AvatarIcon_Ayaka', rank: 'QUALITY_ORANGE', weapon: 'WEAPON_SWORD_ONE_HAND', element: 'Cryo', en: 'Kamisato Ayaka' },
  '10000062': { release: '2021-09-01 00:00:00', icon: 'UI_AvatarIcon_Aloy', rank: 'QUALITY_ORANGE_SP', weapon: 'WEAPON_BOW', element: 'Cryo', en: 'Aloy' },
  '10000020': { release: '2020-09-28 00:00:00', icon: 'UI_AvatarIcon_Razor', rank: 'QUALITY_PURPLE', weapon: 'WEAPON_CLAYMORE', element: 'Electro', en: 'Razor' },
  '10000005-2': { release: '1970-01-01 00:00:00', icon: 'UI_AvatarIcon_PlayerBoy', rank: 'QUALITY_ORANGE', weapon: 'WEAPON_SWORD_ONE_HAND', element: 'Pyro', en: 'Traveler' },
  '10000007-8': { release: '1970-01-01 00:00:00', icon: 'UI_AvatarIcon_PlayerGirl', rank: 'QUALITY_ORANGE', weapon: 'WEAPON_SWORD_ONE_HAND', element: 'Dendro', en: 'Traveler' },
  '10000117-2': { release: '2025-10-21 00:00:00', icon: 'UI_AvatarIcon_MannequinBoy', rank: 'QUALITY_ORANGE_SP', weapon: 'WEAPON_SWORD_ONE_HAND', element: 'Pyro', en: 'Manekin' },
  '10000134': { release: '1970-01-01 00:00:00', icon: 'UI_AvatarIcon_PlayerBoy', rank: 'QUALITY_ORANGE', weapon: 'WEAPON_CROSSBOW', element: 'None', en: 'Traveler' },
};

describe('Genshin from nanoka.cc', () => {
  it('characters: 5★ (and collab 5★) top, 4★ mid, element, weapon type as role, release day at noon UTC+8', () => {
    const list = genshin(CHARS);
    expect(list.map((c) => [c.id, c.name, c.rarity, c.element, c.role, c.releasedAt ?? null])).toEqual([
      ['10000002', 'Kamisato Ayaka', 'top', 'cryo', 'sword', '2021-07-21T04:00:00.000Z'],
      ['10000020', 'Razor', 'mid', 'electro', 'claymore', '2020-09-28T04:00:00.000Z'],
      ['10000062', 'Aloy', 'top', 'cryo', 'bow', '2021-09-01T04:00:00.000Z'],
      ['10000005-2', 'Traveler · Pyro (Aether)', 'top', 'pyro', 'sword', null],
      ['10000007-8', 'Traveler · Dendro (Lumine)', 'top', 'dendro', 'sword', null],
    ]);
    expect(list[0]).toMatchObject({ art: 'https://static.nanoka.cc/assets/gi/UI_Gacha_AvatarImg_Ayaka.webp', portrait: 'https://static.nanoka.cc/assets/gi/UI_AvatarIcon_Ayaka.webp', source: 'nanoka.cc' });
  });

  it('an unknown element or weapon code stops instead of guessing', () => {
    expect(() => genshin({ x: { ...CHARS['10000002'], weapon: 'WEAPON_LANCE' } })).toThrow(/Unknown weapon type code "WEAPON_LANCE"/);
  });

  it('weapons: 5/4/3★ tiers; skins, 1–2★, mode items and unreleased ones left out', () => {
    const W = {
      '11509': { icon: 'UI_EquipIcon_Sword_Narukami', rank: 5, type: 'WEAPON_SWORD_ONE_HAND', en: 'Mistsplitter Reforged' },
      '13401': { icon: 'UI_EquipIcon_Pole_Stardust', rank: 4, type: 'WEAPON_POLE', en: 'Dragonspine Spear' },
      '15301': { icon: 'UI_EquipIcon_Bow_Crowfeather', rank: 3, type: 'WEAPON_BOW', en: 'Raven Bow' },
      '11101': { icon: 'UI_EquipIcon_Sword_Blunt', rank: 1, type: 'WEAPON_SWORD_ONE_HAND', en: 'Dull Blade' },
      '390003': { icon: 'UI_EquipIcon_Sword_X', rank: 4, type: 'WEAPON_SWORD_ONE_HAND', en: 'Exaiphanes Blade', skin: true },
      '224001': { icon: 'UI_X', rank: 4, type: 'ITEM_TPS_WEAPON', en: "Shatanaya's Frostsilver" },
      '14525': { icon: 'UI_EquipIcon_Catalyst_New', rank: 5, type: 'WEAPON_CATALYST', en: 'Leaked Catalyst' },
    };
    expect(genshinWeapons(W, new Set(['14525'])).map((w) => [w.id, w.rarity, w.type])).toEqual([
      ['11509', 'top', 'sword'],
      ['13401', 'mid', 'polearm'],
      ['15301', 'low', 'bow'],
    ]);
  });
});
