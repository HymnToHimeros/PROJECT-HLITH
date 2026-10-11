/**
 * Invite links (T60): https://<site>/community#invite=<secret>. The secret is after the "#",
 * so it never reaches the hosting server or its logs. Opening a link keeps the secret on this
 * device until it is accepted, refused or found unusable, so it survives signing in (Discord
 * and Google return to the start page).
 */
import { COMMUNITY_PATH } from '../shell/route';

export const INVITE_KEY = 'hlith.invite';
const SECRET = /^[a-f0-9]{64}$/;

export const inviteLink = (origin: string, token: string): string => `${origin}${COMMUNITY_PATH}#invite=${token}`;

/** The secret in an address's "#" part, or null. Only well-formed secrets count. */
export function inviteFromHash(hash: string): string | null {
  const m = /(?:^#|&)invite=([^&]+)/.exec(hash);
  const token = m?.[1] ? decodeURIComponent(m[1]).toLowerCase() : null;
  return token && SECRET.test(token) ? token : null;
}

export function pendingInvite(): string | null {
  try {
    const t = localStorage.getItem(INVITE_KEY);
    return t && SECRET.test(t) ? t : null;
  } catch {
    return null;
  }
}

export function setPendingInvite(token: string | null): void {
  try {
    if (token) localStorage.setItem(INVITE_KEY, token);
    else localStorage.removeItem(INVITE_KEY);
  } catch {
    /* storage blocked: the link has to stay open until it's accepted */
  }
}

/**
 * Called once at start: an invite in the address is kept, and taken out of the address
 * (so it isn't bookmarked or shared by accident). Returns the pending invite, if any.
 */
export function captureInvite(): string | null {
  if (typeof window === 'undefined') return null;
  const token = inviteFromHash(window.location.hash);
  if (token) {
    setPendingInvite(token);
    window.history.replaceState(window.history.state, '', COMMUNITY_PATH);
  }
  return pendingInvite();
}

/** Someone's role changed on this device (an invite accepted, T60): the app asks the server again. */
export const ROLES_CHANGED = 'hlith:roles-changed';
export const announceRolesChanged = (): void => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(ROLES_CHANGED));
};
