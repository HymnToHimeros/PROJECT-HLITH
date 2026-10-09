import type { ModuleScreenProps } from '../../core/registry/modules';
import { useNow } from '../../core/ui';
import { setHideLeaks, useHideLeaks } from '../banners/leakPref';
import { LeakSwitch } from '../banners/LeakSwitch';
import { GameIntel, IntelHidden } from './Intel';
import n from './intel.module.css';

/** Intel module: new content no other module covers. Shares the "Hide leaks" switch with Banners. */
export default function IntelScreen({ games, scope }: ModuleScreenProps) {
  const now = useNow(60_000);
  const hideLeaks = useHideLeaks();
  const shown = scope === 'all' ? games : games.filter((g) => g.id === scope);
  return (
    <div className={n.stack}>
      <div className={n.toolbar}>
        <LeakSwitch />
      </div>
      {hideLeaks ? <IntelHidden onShow={() => setHideLeaks(false)} /> : shown.map((g) => <GameIntel key={g.id} game={g} now={now} heading={shown.length > 1} />)}
    </div>
  );
}
