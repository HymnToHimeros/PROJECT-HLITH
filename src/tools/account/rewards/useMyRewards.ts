import { useCallback, useEffect, useState } from 'react';
import type { HeldReward } from './model';
import { serverRewards, type RewardsApi } from './rewardsData';

const NONE: HeldReward[] = [];

/** The rewards you hold (T67). With no account or no server: none, and nothing is asked. */
export function useMyRewards(signedIn: boolean, api: RewardsApi | null = serverRewards): { held: HeldReward[]; reload: () => void } {
  const [held, setHeld] = useState<HeldReward[]>(NONE);
  const ask = signedIn && api !== null;
  const reload = useCallback(() => {
    if (!ask || !api) return;
    void api.mine().then(setHeld, () => setHeld(NONE));
  }, [ask, api]);
  useEffect(reload, [reload]);
  return { held: ask ? held : NONE, reload };
}
