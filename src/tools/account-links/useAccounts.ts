import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GameContract } from '../../core/contract';
import { useSession } from '../../core/auth/session';
import { backend } from '../../core/data/backend';
import { loadDevice, loadServer, mergeAccounts, type LinkedAccount, type ServerState } from './accounts';
import { loadDeviceAccounts, onDeviceAccounts } from './hoyolab';

/** Why the HoYoLAB link can't be used right now, or null when it can. */
export function linkBlocker(signedIn: boolean): string | null {
  if (!backend) return 'This copy of HLITH runs on this device only, without HLITH’s server, so it can’t reach HoYoLAB. The form is shown so you can see how it works.';
  if (!signedIn) return 'Sign in to HLITH first: the HoYoLAB link goes through HLITH’s server, which only answers signed-in players.';
  return null;
}

/** Every linked HoYoLAB account (server + this device) and the results of automatic runs. */
export function useAccounts(games: GameContract[]) {
  const signedIn = Boolean(useSession(backend));
  const [server, setServer] = useState<ServerState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [device, setDevice] = useState<LinkedAccount[]>(loadDevice);
  const [version, setVersion] = useState(0);
  // Callers often pass a fresh array each render; reload only when the set of games changes.
  const gameKey = games.map((g) => g.id).join(',');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableGames = useMemo(() => games, [gameKey]);

  // Logins remembered on this device are encrypted: open them once, then follow every change.
  useEffect(() => {
    const update = () => setDevice(loadDevice());
    const stop = onDeviceAccounts(update);
    void loadDeviceAccounts().then(update);
    return stop;
  }, []);

  useEffect(() => {
    if (!backend || !signedIn) return;
    let alive = true;
    void loadServer(backend, stableGames).then((r) => {
      if (!alive) return;
      if ('error' in r) setLoadError(r.error);
      else {
        setServer(r);
        setLoadError(null);
      }
    });
    return () => {
      alive = false;
    };
  }, [signedIn, stableGames, version]);

  const refresh = useCallback(() => {
    setDevice(loadDevice());
    setVersion((v) => v + 1);
  }, []);
  const live = signedIn ? server : null;
  const accounts = useMemo(() => mergeAccounts(live?.accounts ?? [], device), [live, device]);
  return { signedIn, blocker: linkBlocker(signedIn), accounts, server: live, loadError, refresh };
}
