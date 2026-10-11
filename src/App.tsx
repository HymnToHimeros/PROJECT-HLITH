import { useEffect, useState } from 'react';
import { currentProvider, sendEmailLink, signInWith, signOut, useSession } from './core/auth/session';
import { SignIn } from './core/auth/SignIn';
import { backend } from './core/data/backend';
import { supabaseOwnerThemes } from './core/data/ownerThemesSource';
import { supabaseGameData, supabaseSettings } from './core/data/supabaseSettings';
import { markDeviceOnly, markSignedOut, startSync } from './core/data/sync';
import { listGames } from './core/registry';
import { Shell } from './core/shell/Shell';
import { clearOwnerThemes, loadOwnerThemes } from './core/theme/ownerThemes';
import { Preview } from './core/ui/Preview';

export function App() {
  if (window.location.pathname.replace(/\/$/, '') === '/preview') return <Preview />;
  return <Root />;
}

function Root() {
  const session = useSession(backend);
  const userId = session?.user.id;
  // Which account the owner answer is for, and the answer (null until the server replies).
  const [ownerAnswer, setOwnerAnswer] = useState<{ userId: string; owner: boolean } | null>(null);

  // Ask the server whether this account is an owner (public.is_owner()); only shows the Owner console row.
  useEffect(() => {
    if (!backend || !userId) return;
    let alive = true;
    void backend.rpc('is_owner').then(({ data }) => {
      if (alive) setOwnerAnswer({ userId, owner: data === true });
    });
    return () => {
      alive = false;
    };
  }, [userId]);
  const isOwner = Boolean(userId) && ownerAnswer?.userId === userId && ownerAnswer?.owner === true;
  // Without an account there is nothing to ask; with one, wait for the server's answer.
  const ownerChecked = !backend || !userId || ownerAnswer?.userId === userId;

  // Owner-only themes (T47): downloaded from the private bucket only once the server says owner;
  // for anyone else nothing is asked for, and signing out forgets them.
  useEffect(() => {
    if (backend && isOwner) void loadOwnerThemes(supabaseOwnerThemes(backend));
    else clearOwnerThemes();
  }, [isOwner, userId]);

  useEffect(() => {
    if (!backend) return markDeviceOnly();
    if (session === null) return markSignedOut();
    if (!userId) return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    void startSync(supabaseSettings(backend, userId), 1500, supabaseGameData(backend, userId)).then((s) => (cancelled ? s() : (stop = s)));
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [session, userId]);

  const client = backend;
  if (client && session === undefined) return null; // checking sign-in; keeps the page from flashing
  if (client && session === null) {
    return <SignIn onProvider={(p) => signInWith(client, p)} onEmail={(email) => sendEmailLink(client, email)} />;
  }
  // How you signed in this time (currentProvider), and every method linked to the account (app_metadata.providers).
  const provider = session ? currentProvider(session.user) : undefined;
  const linked = session?.user.app_metadata.providers;
  const methods = Array.isArray(linked) ? (linked as unknown[]).filter((m): m is string => typeof m === 'string') : provider ? [provider] : [];
  const account =
    client && session
      ? { email: session.user.email ?? 'your account', provider, id: session.user.id, identities: methods, createdAt: session.user.created_at, onSignOut: () => void signOut(client) }
      : null;
  return <Shell games={listGames()} account={account} isOwner={isOwner} ownerChecked={ownerChecked} />;
}
