import type { ModuleScreenProps } from '../../core/registry/modules';
import { useNow } from '../../core/ui';
import { GameBanners } from './Banners';
import b from './banners.module.css';
import { useHideLeaks } from './leakPref';
import { LeakSwitch } from './LeakSwitch';

/** Banners module: live and upcoming banners, leaks (hideable), roster fit, Plan pulls (the maths lives in Pulls). One block per game in scope. */
export default function BannersScreen({ games, scope, open }: ModuleScreenProps) {
  const now = useNow(60_000);
  const hideLeaks = useHideLeaks();
  const shown = scope === 'all' ? games : games.filter((g) => g.id === scope);
  return (
    <div className={b.stack}>
      <div className={b.toolbar}>
        <LeakSwitch />
      </div>
      {shown.map((g) => (
        <GameBanners key={g.id} game={g} now={now} heading={shown.length > 1} hideLeaks={hideLeaks} open={open} />
      ))}
    </div>
  );
}
