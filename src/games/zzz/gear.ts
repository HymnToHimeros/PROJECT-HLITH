/** Gear slots in game order, with the main stats each can roll (the build editor, build score and team build wants read it). */
export const GEAR_SLOTS: { id: string; label: string; mains: string[] }[] = [
  { id: 'Disc 1', label: 'Disc 1', mains: ['HP'] },
  { id: 'Disc 2', label: 'Disc 2', mains: ['ATK'] },
  { id: 'Disc 3', label: 'Disc 3', mains: ['DEF'] },
  { id: 'Disc 4', label: 'Disc 4', mains: ['HP %', 'ATK %', 'DEF %', 'CRIT Rate', 'CRIT DMG', 'Anomaly Proficiency'] },
  { id: 'Disc 5', label: 'Disc 5', mains: ['HP %', 'ATK %', 'DEF %', 'PEN Ratio', 'Physical DMG Bonus', 'Fire DMG Bonus', 'Ice DMG Bonus', 'Electric DMG Bonus', 'Ether DMG Bonus', 'Wind DMG Bonus'] },
  { id: 'Disc 6', label: 'Disc 6', mains: ['HP %', 'ATK %', 'DEF %', 'Anomaly Mastery', 'Impact', 'Energy Regen'] },
];

/** Drive Disc sets fit any disc: no fixed slots. */
export const SET_SLOTS = (): string[] => [];
export const LEVEL_MAX = 60;
