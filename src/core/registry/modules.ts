import type { ComponentType } from 'react';
import { MODULE_IDS, type GameContract, type GameId, type ModuleId } from '../contract';

/** What the shell knows about a module. The screen itself lives in tools/ and is attached by main.tsx. */
export interface ModuleDef {
  id: ModuleId;
  label: string;
  glyph: string;
  tabs?: { id: string; label: string }[];
}

export interface ModuleScreenProps {
  games: GameContract[];
  scope: GameId | 'all';
}
export type ModuleScreen = ComponentType<ModuleScreenProps>;
type ScreenLoader = () => Promise<{ default: ModuleScreen }>;

export const MODULES: Record<ModuleId, ModuleDef> = {
  today: { id: 'today', label: 'Today', glyph: 'TD' },
  events: { id: 'events', label: 'Events', glyph: 'EV' },
  calendar: { id: 'calendar', label: 'Calendar', glyph: 'CA' },
  backlog: { id: 'backlog', label: 'Backlog', glyph: 'BL' },
  pulls: {
    id: 'pulls',
    label: 'Pulls',
    glyph: 'PL',
    // Override 3: four tabs; Luck report is a card inside History.
    tabs: [
      { id: 'planner', label: 'Planner' },
      { id: 'calculator', label: 'Calculator' },
      { id: 'log', label: 'Bank log' },
      { id: 'history', label: 'History' },
    ],
  },
  banners: { id: 'banners', label: 'Banners', glyph: 'BN' },
  roster: {
    id: 'roster',
    label: 'Roster',
    glyph: 'RS',
    tabs: [
      { id: 'characters', label: 'Characters' },
      { id: 'teams', label: 'Teams' },
    ],
  },
  farm: { id: 'farm', label: 'Farm', glyph: 'FM' },
  intel: { id: 'intel', label: 'Intel', glyph: 'IN' },
};

export const MODULE_CATALOG: readonly ModuleId[] = MODULE_IDS;

const screens = new Map<ModuleId, ScreenLoader>();

export function registerModuleScreen(id: ModuleId, load: ScreenLoader): void {
  screens.set(id, load);
}

export function moduleScreen(id: ModuleId): ScreenLoader | undefined {
  return screens.get(id);
}
