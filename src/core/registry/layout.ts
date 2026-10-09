import type { GameContract, GameId, ModuleId } from '../contract';
import { MODULE_CATALOG } from './modules';

/** Per user, per scope ('hsr', 'zzz', … or 'all'). Stored with the user's data. */
export interface LayoutState {
  order: ModuleId[];
  hidden: ModuleId[];
}
export type Scope = GameId | 'all';

/** Modules a set of games offers. For one game, its own list; for All games, the union. */
export function offered(games: GameContract[]): ModuleId[] {
  const set = new Set(games.flatMap((g) => g.modules));
  return MODULE_CATALOG.filter((m) => set.has(m));
}

/**
 * Default layout: the one shared catalogue order, for every game and for All
 * games, so a module shared by two games sits in the same place in both bars.
 * Modules a game lacks simply drop out. Your own changes override this.
 */
export function defaultLayout(): LayoutState {
  return { order: [...MODULE_CATALOG], hidden: [] };
}

/**
 * The module slot: what the game offers − what you hid, in your order.
 * Modules you never ordered (a new module, a new game) go at the end in default order.
 */
export function slot(games: GameContract[], scope: Scope, layout: LayoutState): ModuleId[] {
  const inScope = scope === 'all' ? games : games.filter((g) => g.id === scope);
  const available = offered(inScope);
  const base = defaultLayout().order;
  const ordered = [
    ...layout.order.filter((m) => available.includes(m)),
    ...base.filter((m) => available.includes(m) && !layout.order.includes(m)),
  ];
  return ordered.filter((m) => !layout.hidden.includes(m));
}

/** Hidden = the game has it, you turned it off (dashed, Restore). */
export function hiddenIn(games: GameContract[], scope: Scope, layout: LayoutState): ModuleId[] {
  const inScope = scope === 'all' ? games : games.filter((g) => g.id === scope);
  const available = offered(inScope);
  return layout.hidden.filter((m) => available.includes(m));
}

/** Not available = the record lacks it (hatched, no action). Never shown for All games. */
export function notAvailable(games: GameContract[], scope: Scope): ModuleId[] {
  if (scope === 'all') return [];
  const game = games.find((g) => g.id === scope);
  return game ? MODULE_CATALOG.filter((m) => !game.modules.includes(m)) : [];
}

export const PHONE_BAR_SIZE = 4;

/** Phone: the first four visible modules form the bottom bar, the rest live in More. */
export function phoneBar(visible: ModuleId[]): { bar: ModuleId[]; more: ModuleId[] } {
  return { bar: visible.slice(0, PHONE_BAR_SIZE), more: visible.slice(PHONE_BAR_SIZE) };
}

/** Hide a module. Refuses to hide the last visible one. */
export function hide(games: GameContract[], scope: Scope, layout: LayoutState, id: ModuleId): LayoutState {
  const visible = slot(games, scope, layout);
  if (!visible.includes(id) || visible.length <= 1) return layout;
  return { ...layout, hidden: [...layout.hidden, id] };
}

export function restore(layout: LayoutState, id: ModuleId): LayoutState {
  return { ...layout, hidden: layout.hidden.filter((m) => m !== id) };
}

/** Move a visible module to a new position among the visible ones. */
export function move(games: GameContract[], scope: Scope, layout: LayoutState, id: ModuleId, toIndex: number): LayoutState {
  const visible = slot(games, scope, layout);
  const from = visible.indexOf(id);
  if (from === -1) return layout;
  const next = visible.filter((m) => m !== id);
  next.splice(Math.max(0, Math.min(toIndex, next.length)), 0, id);
  // Keep hidden modules' remembered positions at the end so Restore brings them back.
  return { ...layout, order: [...next, ...layout.hidden.filter((m) => !next.includes(m))] };
}

/** "Reset to default": the shared default order, nothing hidden. */
export function reset(): LayoutState {
  return defaultLayout();
}
