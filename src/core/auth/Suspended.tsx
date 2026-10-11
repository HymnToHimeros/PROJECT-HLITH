import { formatDateTime } from '../time/reset';
import { Button } from '../ui/Button';
import { LegalLinks } from './SignIn';
import s from './signin.module.css';

/** The project's public contact address (the same one as on /privacy and /terms; a test keeps them equal). */
export const CONTACT_EMAIL = 'hlidskjalf.contact@gmail.com';

/**
 * A suspended account (T60b): calm, plain, no blame. Shown instead of the app while a ban
 * runs, and on the sign-in screen when signing in was refused for a ban. The server refuses
 * the account's data either way. `until` null = we don't know (sign-in refused), Infinity = no end set.
 */
export function Suspended({ until, onSignOut }: { until: number | null; onSignOut?: (() => void) | undefined }) {
  const when = until === null ? null : until === Infinity ? 'until further notice' : `until ${formatDateTime(until)}`;
  return (
    <main className={s.page}>
      <div className={s.card} role="alert" aria-labelledby="suspended-title">
        <div className="t-label">HLIÐSKJÁLF</div>
        <h1 className={`t-display ${s.name}`} id="suspended-title">
          Account suspended
        </h1>
        <p className={s.lead}>This account is suspended{when ? ` ${when}` : ''}.</p>
        <p className={s.about}>
          Your data is kept and nothing is lost. Questions: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
        {onSignOut && (
          <Button className={s.wide} onClick={onSignOut}>
            Sign out
          </Button>
        )}
        <LegalLinks />
      </div>
    </main>
  );
}

/** Supabase sends a refused sign-in back with the reason in the address (?error_code=… or #error_code=…). */
export function bannedInAddress(search: string, hash: string): boolean {
  const all = `${search}&${hash.replace(/^#/, '')}`;
  return /(?:^|[?&])error_code=user_banned(?:&|$)/.test(all) || /error_description=[^&]*banned/i.test(all);
}
