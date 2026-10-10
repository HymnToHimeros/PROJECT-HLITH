/** Every Light Cone read for the kit check (T18 step 4), signatures aside (they live in their character's sheet). */
import type { WeaponSheet } from '../types';
import { WEAPONS_ABUNDANCE_REMEMBRANCE_ELATION } from './abundance-remembrance-elation';
import { WEAPONS_DESTRUCTION_HUNT_ERUDITION } from './destruction-hunt-erudition';
import { WEAPONS_HARMONY_NIHILITY_PRESERVATION } from './harmony-nihility-preservation';

export const WEAPON_SHEETS: WeaponSheet[] = [...WEAPONS_DESTRUCTION_HUNT_ERUDITION, ...WEAPONS_HARMONY_NIHILITY_PRESERVATION, ...WEAPONS_ABUNDANCE_REMEMBRANCE_ELATION];
