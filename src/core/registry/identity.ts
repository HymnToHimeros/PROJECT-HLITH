import type { PanelAccount } from './panels';

/**
 * Who is using HLITH, as the shell shows it in the sidebar's profile card: name,
 * picture and banner. The profile itself lives in tools/account; main.tsx attaches
 * it here with registerIdentity, so the shell never imports tools/.
 */
export interface ShellIdentity {
  /** The name to show. null = none chosen (the shell falls back to the email name). */
  name: string | null;
  /** Something an <img> can show, or null for initials. */
  avatarUrl: string | null;
  /** Something an <img> can show, or null for the theme's own gradient. */
  bannerUrl: string | null;
}

/** A React hook that returns the current identity (or null while unknown). Called on every shell render. */
export type IdentityHook = (account: PanelAccount | null) => ShellIdentity | null;

const none: IdentityHook = () => null;
let useSource: IdentityHook = none;

/** Attach the profile source. Call once, before the first render (main.tsx). */
export function registerIdentity(hook: IdentityHook): void {
  useSource = hook;
}

/** The identity to show in the shell. Falls back to null when nothing is attached (tests, the bare shell). */
export function useIdentity(account: PanelAccount | null): ShellIdentity | null {
  return useSource(account);
}

/** For tests: detach the source again. */
export function resetIdentity(): void {
  useSource = none;
}
