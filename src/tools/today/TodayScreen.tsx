import { useMemo } from 'react';
import type { ModuleScreenProps } from '../../core/registry/modules';
import { useExamplesShown } from '../../core/data/prefs';
import { useNow } from '../../core/ui';
import { useLiveStamina } from '../account-links/liveStamina';
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
  const live = useLiveStamina(shown);
  if (!lists) return null;
  return <WithUserData games={shown}>{(user) => <Today games={shown} servers={servers} lists={withOwnItems(shown, lists, user, { showExamples, hideLeaks, now })} user={user} now={now} open={open} openAccount={openAccount} openServer={openServer} stamina={live.stamina} retryStamina={live.retry} />}</WithUserData>;
}
