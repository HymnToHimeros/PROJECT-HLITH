import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { GameContract, GameId, ModuleId } from '../contract';

/** Panels the shell opens from anywhere (Account/Settings, Assistant). Their content lives in tools/, attached by main.tsx. */
export type PanelId = 'settings' | 'assistant' | 'owner';

/** A signed-in account, as the shell knows it. */
export interface PanelAccount {
  email: string;
  /** How they signed in: 'google', 'discord', 'email'… when the session says. */
  provider?: string | undefined;
  onSignOut: () => void;
}

export interface PanelProps {
  /** Games the viewer has switched on. */
  games: GameContract[];
  /** Every registered game (for turning games on and off). */
  allGames: GameContract[];
  scope: GameId | 'all';
  servers: Record<GameId, string>;
  /** Signed-in account, or null (signed out, or this device only). */
  account: PanelAccount | null;
  close: () => void;
  /** Go to a module (optionally a tab) in the current game scope; closes the panel. */
  open: (module: ModuleId, tab?: string) => void;
  /** Open the Edit layout panel. */
  editLayout: () => void;
  /**
   * The viewer is a site owner. Always false until an owner check exists
   * (public.is_owner() on the server); the Account sheet only shows the
   * Owner console row when this is true.
   */
  isOwner?: boolean;
  /** Open the console for owners (only called when isOwner). */
  openOwnerConsole?: () => void;
  /** Sub-page to start on, e.g. 'game-settings' (from a "Choose server" button elsewhere). */
  startPage?: string | undefined;
}

export type Panel = ComponentType<PanelProps>;
const panels = new Map<PanelId, LazyExoticComponent<Panel>>();

export function registerPanel(id: PanelId, load: () => Promise<{ default: Panel }>): void {
  panels.set(id, lazy(load));
}

export function panel(id: PanelId): LazyExoticComponent<Panel> | undefined {
  return panels.get(id);
}
