import { useMemo } from 'react';
import type { ModuleScreenProps } from '../../core/registry/modules';
import { useNow } from '../../core/ui';
import { inScope, useGameLists, WithUserData, withOwnItems } from '../today/lists';
import { Calendar } from './Calendar';

/** Calendar module. In All games every game shares one timeline, each bar tagged with its game. */
export default function CalendarScreen({ games, scope, servers, openAccount, openServer, now: fixedNow }: ModuleScreenProps & { now?: number }) {
  const liveNow = useNow(60_000);
  const now = fixedNow ?? liveNow;
  const shown = useMemo(() => inScope(games, scope), [games, scope]);
  const lists = useGameLists(shown);
  if (!lists) return null;
  return (
    <WithUserData games={shown}>
      {(user) => (
        <Calendar
          games={shown}
          servers={servers}
          lists={withOwnItems(lists, user)}
          plans={shown.flatMap((g) => (user[g.id]?.plans ?? []).filter((p) => p.status === 'active').map((p) => ({ game: g, plan: p })))}
          now={now}
          openAccount={openAccount}
          openServer={openServer}
        />
      )}
    </WithUserData>
  );
}
