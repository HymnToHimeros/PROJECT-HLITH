import { useSyncExternalStore } from 'react';
import { MODULE_IDS, type ModuleId } from '../contract';
import type { Scope } from '../registry/layout';

/** Addresses look like /hsr/pulls or /all/today. */
export interface Route {
  scope: Scope | null;
  module: ModuleId | null;
}

export function parseRoute(path: string): Route {
  const [scope, module] = path.split('/').filter(Boolean);
  return {
    scope: scope ?? null,
    module: module && (MODULE_IDS as readonly string[]).includes(module) ? (module as ModuleId) : null,
  };
}

export const routePath = (scope: Scope, module: ModuleId) => `/${scope}/${module}`;

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
if (typeof window !== 'undefined') window.addEventListener('popstate', notify);

export function navigate(path: string, replace = false): void {
  if (window.location.pathname === path) return;
  if (replace) window.history.replaceState(null, '', path);
  else window.history.pushState(null, '', path);
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
