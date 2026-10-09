import { useMemo } from 'react';
import type { ModuleScreenProps } from '../../core/registry/modules';
import { HowTo, useNow } from '../../core/ui';
import { setHideLeaks, useHideLeaks } from '../banners/leakPref';
import { LeakSwitch } from '../banners/LeakSwitch';
import { inScope, useGameLists } from '../today/lists';
import { Intel, IntelHidden } from './Intel';
import n from './intel.module.css';

/** Intel module (design): new content no other module covers. Shares the "Hide leaks" switch with Banners. */
export default function IntelScreen({ games, scope }: ModuleScreenProps) {
  const now = useNow(60_000);
  const hideLeaks = useHideLeaks();
  const shown = useMemo(() => inScope(games, scope), [games, scope]);
  const lists = useGameLists(shown);
  return (
    <div className={n.stack}>
      <div className={n.intro}>
        <p className={n.lead}>
          New content that no other module covers yet. Everything stays unverified until the game confirms it; banners and dates from leaks also show in Banners and Calendar.
        </p>
        <LeakSwitch />
      </div>
      <HowTo
        steps={[
          <>Each card is something new that isn’t out yet: a character, an area, an event or a change to the game.</>,
          <>Everything here is <strong>unverified</strong>: it comes from leaks or the game files and can still change. The source is always shown.</>,
          <>Use the buttons above the list to show only one kind.</>,
          <>Don’t want spoilers? Turn on <strong>Hide leaks</strong>. It also hides leaks in Banners and Calendar.</>,
        ]}
      >
        Leak alerts (a message when a character you want leaks) will come with the evening message in Account.
      </HowTo>
      {hideLeaks ? <IntelHidden onShow={() => setHideLeaks(false)} /> : lists ? <Intel games={shown} lists={lists} now={now} /> : <p className={n.muted}>Loading…</p>}
    </div>
  );
}
