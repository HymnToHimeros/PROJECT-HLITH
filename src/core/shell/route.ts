import { useSyncExternalStore } from 'react';
import { MODULE_IDS, type ModuleId } from '../contract';
import type { Scope } from '../registry/layout';

/** Addresses look like /hsr/pulls or /all/today; a module with tabs adds the tab: /hsr/pulls/log, /hsr/roster/teams. */
export interface Route {
  scope: Scope | null;
  module: ModuleId | null;
  /** The tab from the address. The shell checks it against the module's tabs. */
  tab: string | null;
}

export function parseRoute(path: string): Route {
  const [scope, module, tab] = path.split('/').filter(Boolean);
  const mod = module && (MODULE_IDS as readonly string[]).includes(module) ? (module as ModuleId) : null;
  return {
    scope: scope ?? null,
    module: mod,
    tab: mod && tab ? decodeURIComponent(tab) : null,
  };
}

export const routePath = (scope: Scope, module: ModuleId, tab?: string | null) => `/${scope}/${module}${tab ? `/${encodeURIComponent(tab)}` : ''}`;

/** The Account page: /account, /account/<section>, /account/<section>/<detail> (e.g. /account/game-settings/hsr). */
export interface AccountRoute {
  section: string | null;
  detail: string | null;
}

export function parseAccountRoute(path: string): AccountRoute | null {
  const [first, section, detail] = path.split('/').filter(Boolean);
  if (first !== 'account') return null;
  return { section: section ? decodeURIComponent(section) : null, detail: detail ? decodeURIComponent(detail) : null };
}

export const accountPath = (section?: string | null, detail?: string | null): string =>
  ['/account', section && encodeURIComponent(section), section && detail && encodeURIComponent(detail)].filter(Boolean).join('/');

/** True when the page before this one in the tab's history was inside HLITH (so "back" stays in the app). */
export const cameFromApp = (): boolean => typeof window !== 'undefined' && (window.history.state as { inApp?: boolean } | null)?.inApp === true;

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
if (typeof window !== 'undefined') window.addEventListener('popstate', notify);

export function navigate(path: string, replace = false): void {
  if (window.location.pathname === path) return;
  if (replace) window.history.replaceState(window.history.state, '', path);
  else window.history.pushState({ inApp: true }, '', path);
  notify();
}

export function usePath(): string {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => window.location.pathname,
    () => '/',
  );
}
