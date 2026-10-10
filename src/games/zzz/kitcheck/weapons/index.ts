/** Every W-Engine read for the kit check (T18 step 4), signatures aside (they live in their agent's sheet). */
import type { WeaponSheet } from '../types';
import { WEAPONS_ALL } from './all';

export const WEAPON_SHEETS: WeaponSheet[] = [...WEAPONS_ALL];
