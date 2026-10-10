/** Gear slots in game order, with the main stats each can roll (the build editor, build score and team build wants read it). */
export const GEAR_SLOTS: { id: string; label: string; mains: string[] }[] = [
  { id: 'Head', label: 'Head', mains: ['HP'] },
  { id: 'Hands', label: 'Hands', mains: ['ATK'] },
  { id: 'Body', label: 'Body', mains: ['HP %', 'ATK %', 'DEF %', 'CRIT Rate', 'CRIT DMG', 'Outgoing Healing Boost', 'Effect Hit Rate'] },
  { id: 'Feet', label: 'Feet', mains: ['HP %', 'ATK %', 'DEF %', 'SPD'] },
  {
    id: 'Planar Sphere',
    label: 'Planar Sphere',
    mains: ['HP %', 'ATK %', 'DEF %', 'Physical DMG Boost', 'Fire DMG Boost', 'Ice DMG Boost', 'Lightning DMG Boost', 'Wind DMG Boost', 'Quantum DMG Boost', 'Imaginary DMG Boost'],
  },
  { id: 'Link Rope', label: 'Link Rope', mains: ['HP %', 'ATK %', 'DEF %', 'Break Effect', 'Energy Regeneration Rate'] },
];
