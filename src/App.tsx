import { useEffect, useState } from 'react';
import { currentProvider, sendEmailLink, signInWith, signOut, useSession } from './core/auth/session';
import { FirstRun } from './core/auth/FirstRun';
import { serverGate, setGate, type Gate } from './core/auth/gate';
import { captureInvite, pendingInvite, ROLES_CHANGED } from './core/auth/invite';
import { rememberTester, SignIn } from './core/auth/SignIn';
import { setStanding, standingFrom, useStanding } from './core/auth/standing';
import { bannedInAddress, Suspended } from './core/auth/Suspended';
import { backend } from './core/data/backend';
import { supabaseOwnerThemes } from './core/data/ownerThemesSource';
import { supabaseGameData, supabaseSettings } from './core/data/supabaseSettings';
import { markDeviceOnly, markSignedOut, startSync } from './core/data/sync';
import { listGames } from './core/registry';
import { COMMUNITY_PATH, isCommunityPath, navigate } from './core/shell/route';
import { Shell } from './core/shell/Shell';
import { clearOwnerThemes, loadOwnerThemes } from './core/theme/ownerThemes';
import { Preview } from './core/ui/Preview';

// An invite link (T60) is taken out of the address and kept on this device until it is used.
const invitedAtStart = typeof window !== 'undefined' ? captureInvite() : null;
/** Export my data (R56) as a file. A suspended account can still use it (T60b): its own data, read-only. */
async function downloadMyData(client: NonNullable<typeof backend>): Promise<void> {
  const { data, error } = await client.functions.invoke('export-data', { body: {} });
  if (error) throw new Error('The download didn’t work. Try again in a moment.');
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `HLITH-account-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

// A sign-in refused because the account is suspended comes back with the reason in the address (T60b).
const refusedAsBanned = typeof window !== 'undefined' && bannedInAddress(window.location.search, window.location.hash);

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

  // Community member (tester or owner, T60): public.is_member() on the server. Only shows the Community link;
  // the server refuses community data to anyone else.
  const [memberAnswer, setMemberAnswer] = useState<{ userId: string; member: boolean } | null>(null);
  const [rolesAsked, setRolesAsked] = useState(0);
  useEffect(() => {
    const again = () => setRolesAsked((n) => n + 1);
    window.addEventListener(ROLES_CHANGED, again);
    return () => window.removeEventListener(ROLES_CHANGED, again);
  }, []);
  useEffect(() => {
    if (!backend || !userId) return;
    let alive = true;
    void backend.rpc('is_member').then(({ data, error }) => {
      if (!alive || error) return;
      setMemberAnswer({ userId, member: data === true });
      // Email sign-in on this device follows the real role: testers and the owner keep it, everyone else doesn't.
      rememberTester(data === true);
    });
    return () => {
      alive = false;
    };
  }, [userId, rolesAsked]);
  const isMember = Boolean(userId) && memberAnswer?.userId === userId && memberAnswer?.member === true;

  // A ban or silence still running (T60b): public.my_standing(). The server refuses a banned
  // account's data anyway; this shows a calm screen instead of an app that can't load anything.
  useEffect(() => {
    if (!backend || !userId) return setStanding(null);
    let alive = true;
    void backend.rpc('my_standing').then(({ data, error }) => {
      if (alive && !error) setStanding(standingFrom(data));
    });
    return () => {
      alive = false;
    };
  }, [userId, rolesAsked]);
  const { banned, standing } = useStanding();

  // First run (T62): accept the current Terms and Privacy policy and choose a username before
  // the app opens. If the server can't answer (for example an older server), the app isn't
  // blocked: the server's own rules still refuse app data until both are done.
  const [gateAnswer, setGateAnswer] = useState<{ userId: string; gate: Gate | null } | null>(null);
  useEffect(() => {
    if (!serverGate || !userId) return setGate(null);
    let alive = true;
    void serverGate.load().then(
      (gate) => {
        if (!alive) return;
        setGateAnswer({ userId, gate });
        setGate(gate);
      },
      () => alive && setGateAnswer({ userId, gate: null }),
    );
    return () => {
      alive = false;
    };
  }, [userId]);
  const gate = userId && gateAnswer?.userId === userId ? gateAnswer.gate : undefined;
  const gateOpen = !serverGate || !userId || gate === null || gate?.accepted === true;
  const onGate = (next: Gate) => {
    if (!userId) return;
    setGateAnswer({ userId, gate: next });
    setGate(next);
  };

  // Back from signing in with an invite waiting: open the Community page to accept it.
  useEffect(() => {
    if (userId && pendingInvite() && !isCommunityPath(window.location.pathname)) navigate(COMMUNITY_PATH, true);
  }, [userId]);
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
    // Nothing is saved to the account before the first-run steps are done.
    if (!userId || !gateOpen) return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    void startSync(supabaseSettings(backend, userId), 1500, supabaseGameData(backend, userId)).then((s) => (cancelled ? s() : (stop = s)));
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [session, userId, gateOpen]);

  const client = backend;
  if (client && session === undefined) return null; // checking sign-in; keeps the page from flashing
  if (client && session && banned) return <Suspended until={standing.bannedUntil} onSignOut={() => void signOut(client)} onDownload={() => downloadMyData(client)} />;
  if (client && session === null && refusedAsBanned) return <Suspended until={null} />;
  if (client && session && gate === undefined) return null; // asking where the account stands
  if (client && session && serverGate && gate && !gate.accepted) return <FirstRun gate={gate} api={serverGate} onDone={onGate} onSignOut={() => void signOut(client)} />;
  if (client && session === null) {
    return <SignIn onProvider={(p) => signInWith(client, p)} onEmail={(email) => sendEmailLink(client, email)} invited={invitedAtStart !== null} />;
  }
  // How you signed in this time (currentProvider), and every method linked to the account (app_metadata.providers).
  const provider = session ? currentProvider(session.user) : undefined;
  const linked = session?.user.app_metadata.providers;
  const methods = Array.isArray(linked) ? (linked as unknown[]).filter((m): m is string => typeof m === 'string') : provider ? [provider] : [];
  const account =
    client && session
      ? { email: session.user.email ?? 'your account', provider, id: session.user.id, identities: methods, createdAt: session.user.created_at, onSignOut: () => void signOut(client) }
      : null;
  return <Shell games={listGames()} account={account} isOwner={isOwner} ownerChecked={ownerChecked} isMember={isMember} />;
}
