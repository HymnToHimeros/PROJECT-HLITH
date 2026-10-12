/**
 * Claim links (T67): https://<site>/account/profile#claim=<code>. The code is after the "#",
 * so it never reaches the hosting server or its logs. Opening a link keeps the code on this
 * device until it is claimed or found unusable, so it survives signing in.
 */
import { accountPath } from '../../../core/shell/route';
import { codeKey } from './model';

export const CLAIM_KEY = 'hlith.claim';
export const CLAIM_PATH = accountPath('profile');
const CODE = /^[A-Z0-9]{8,32}$/;

export const claimLink = (origin: string, code: string): string => `${origin}${CLAIM_PATH}#claim=${codeKey(code)}`;

export function claimFromHash(hash: string): string | null {
  const m = /(?:^#|&)claim=([^&]+)/.exec(hash);
  const code = m?.[1] ? codeKey(decodeURIComponent(m[1])) : null;
  return code && CODE.test(code) ? code : null;
}

export function pendingClaim(): string | null {
  try {
    const c = localStorage.getItem(CLAIM_KEY);
    return c && CODE.test(c) ? c : null;
  } catch {
    return null;
  }
}

export function setPendingClaim(code: string | null): void {
  try {
    if (code) localStorage.setItem(CLAIM_KEY, code);
    else localStorage.removeItem(CLAIM_KEY);
  } catch {
    /* storage blocked: the link has to stay open until it's claimed */
  }
}

/** Called once at start: a code in the address is kept and taken out of the address. */
export function captureClaim(): string | null {
  if (typeof window === 'undefined') return null;
  const code = claimFromHash(window.location.hash);
  if (code) {
    setPendingClaim(code);
    window.history.replaceState(window.history.state, '', CLAIM_PATH);
  }
  return pendingClaim();
}
