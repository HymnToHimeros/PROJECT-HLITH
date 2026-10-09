import { useEffect, useState } from 'react';
import { currentProvider, sendEmailLink, signInWith, signOut, useSession } from './core/auth/session';
import { SignIn } from './core/auth/SignIn';
import { backend } from './core/data/backend';
import { supabaseSettings } from './core/data/supabaseSettings';
import { markDeviceOnly, markSignedOut, startSync } from './core/data/sync';
import { listGames } from './core/registry';
import { Shell } from './core/shell/Shell';
import { Preview } from './core/ui/Preview';

export function App() {
  if (window.location.pathname.replace(/\/$/, '') === '/preview') return <Preview />;
  return <Root />;
}

function Root() {
  const session = useSession(backend);
  const userId = session?.user.id;
  const [ownerOf, setOwnerOf] = useState<string | null>(null);

  // Ask the server whether this account is an owner (public.is_owner()); only shows the Owner console row.
  useEffect(() => {
    if (!backend || !userId) return;
    let alive = true;
    void backend.rpc('is_owner').then(({ data }) => {
      if (alive) setOwnerOf(data === true ? userId : null);
    });
    return () => {
      alive = false;
    };
  }, [userId]);
  const isOwner = Boolean(userId) && ownerOf === userId;

  useEffect(() => {
    if (!backend) return markDeviceOnly();
    if (session === null) return markSignedOut();
    if (!userId) return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    void startSync(supabaseSettings(backend, userId)).then((s) => (cancelled ? s() : (stop = s)));
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
  return <Shell games={listGames()} account={account} isOwner={isOwner} />;
}
