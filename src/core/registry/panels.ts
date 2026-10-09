import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { GameContract, GameId, ModuleId } from '../contract';

/**
 * Pages and panels the shell opens from anywhere: the Account page (/account) and the
 * Assistant panel. Their content lives in tools/, attached by main.tsx, so the shell
 * never imports tools/.
 */
export type PanelId = 'account' | 'assistant';

/** A signed-in account, as the shell knows it. */
export interface PanelAccount {
  email: string;
  /** How they signed in: 'google', 'discord', 'email'… when the session says. */
  provider?: string | undefined;
  /** The account's id (for its own profile row and picture folder). */
  id?: string | undefined;
  /** Every sign-in method linked to this account ('discord', 'google', 'email'…), from the session. */
  identities?: string[] | undefined;
  /** When the account was made (ISO), from the session. */
  createdAt?: string | undefined;
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
  /** Leave the page or panel (back to the module you were on). */
  close: () => void;
  /** Go to a module (optionally a tab) in the current game scope; closes the panel. */
  open: (module: ModuleId, tab?: string) => void;
  /** Open the Edit layout panel. */
  editLayout: () => void;
  /**
   * The viewer is a site owner (public.is_owner() on the server). The Account page
   * only shows the Owner console section when this is true; every owner write is
   * still checked on the server.
   */
  isOwner?: boolean;
  /** Account page: the section in the address (/account/<section>), e.g. 'game-settings'. Missing = Profile. */
  section?: string | undefined;
  /** Account page: the detail after the section (/account/game-settings/<game id>). */
  detail?: string | undefined;
  /** Account page: open a section. Adds a history step, so the browser's back button returns. */
  goSection?: (section: string, detail?: string) => void;
}

export type Panel = ComponentType<PanelProps>;
const panels = new Map<PanelId, LazyExoticComponent<Panel>>();

export function registerPanel(id: PanelId, load: () => Promise<{ default: Panel }>): void {
  panels.set(id, lazy(load));
}

export function panel(id: PanelId): LazyExoticComponent<Panel> | undefined {
  return panels.get(id);
}
