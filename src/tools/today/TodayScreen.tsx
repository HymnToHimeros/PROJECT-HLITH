import { useMemo } from 'react';
import type { ModuleScreenProps } from '../../core/registry/modules';
import { useNow } from '../../core/ui';
import { inScope, useGameLists, WithUserData } from './lists';
import { Today } from './Today';

/**
 * Today module. In All games everything merges into one screen: one run in
 * order across games, every row tagged with its game.
 * `now` is only passed by tests; the screen otherwise follows the clock.
 */
export default function TodayScreen({ games, scope, servers, open, openAccount, openServer, now: fixedNow }: ModuleScreenProps & { now?: number }) {
  const liveNow = useNow(30_000);
  const now = fixedNow ?? liveNow;
  const shown = useMemo(() => inScope(games, scope), [games, scope]);
  const lists = useGameLists(shown);
  if (!lists) return null;
  return <WithUserData games={shown}>{(user) => <Today games={shown} servers={servers} lists={lists} user={user} now={now} open={open} openAccount={openAccount} openServer={openServer} />}</WithUserData>;
}
