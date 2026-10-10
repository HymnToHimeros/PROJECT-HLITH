import { useCallback, useMemo } from 'react';
import type { ModuleScreenProps } from '../../core/registry/modules';
import { useExamplesShown } from '../../core/data/prefs';
import { useNow } from '../../core/ui';
import { useLiveStamina, type OnReading } from '../account-links/liveStamina';
import { gameData, setTick } from '../../core/data/userData';
import { serverRule } from '../../core/time/reset';
import { autoTicks, claimAutoTicks } from './autoTick';
import { useHideLeaks } from '../banners/leakPref';
import { inScope, useGameLists, WithUserData, withOwnItems } from './lists';
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
  const showExamples = useExamplesShown();
  const hideLeaks = useHideLeaks();
  // Each fresh HoYoLAB read ticks what its numbers prove (autoTick.ts); only with a server chosen.
  const onReading = useCallback<OnReading>(
    (game, previous, next, dailies) => {
      const serverId = servers[game.id];
      if (!serverId) return;
      const rule = serverRule(game, serverId);
      const proven = autoTicks({ game, rule, previous, next, dailies, ticks: gameData(game.id).ticks });
      for (const t of claimAutoTicks(game.id, rule, proven)) setTick(game.id, t.taskId, t.at);
    },
    [servers],
  );
  const live = useLiveStamina(shown, onReading);
  if (!lists) return null;
  return <WithUserData games={shown}>{(user) => <Today games={shown} servers={servers} lists={withOwnItems(shown, lists, user, { showExamples, hideLeaks, now, servers })} user={user} now={now} open={open} openAccount={openAccount} openServer={openServer} stamina={live.stamina} retryStamina={live.retry} />}</WithUserData>;
}
