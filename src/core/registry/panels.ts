import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { GameContract, GameId, ModuleId } from '../contract';

/** Side panels the shell opens from anywhere (Account/Settings, Assistant). Their content lives in tools/, attached by main.tsx. */
export type PanelId = 'settings' | 'assistant';

export interface PanelProps {
  /** Games the viewer has switched on. */
  games: GameContract[];
  /** Every registered game (for turning games on and off). */
  allGames: GameContract[];
  scope: GameId | 'all';
  servers: Record<GameId, string>;
  /** Signed-in account, or null (signed out, or this device only). */
  account: { email: string; onSignOut: () => void } | null;
  close: () => void;
  /** Go to a module (optionally a tab) in the current game scope; closes the panel. */
  open: (module: ModuleId, tab?: string) => void;
  /** Open the Edit layout panel. */
  editLayout: () => void;
}

export type Panel = ComponentType<PanelProps>;
const panels = new Map<PanelId, LazyExoticComponent<Panel>>();

export function registerPanel(id: PanelId, load: () => Promise<{ default: Panel }>): void {
  panels.set(id, lazy(load));
}

export function panel(id: PanelId): LazyExoticComponent<Panel> | undefined {
  return panels.get(id);
}
