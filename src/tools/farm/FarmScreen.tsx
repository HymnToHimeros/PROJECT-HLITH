import { useMemo } from 'react';
import type { ModuleScreenProps } from '../../core/registry/modules';
import { inScope, useGameLists, WithUserData } from '../today/lists';
import { Farm, type FarmGame } from './Farm';
import f from './farm.module.css';

/** Farm module (design: "Farm for" chips → stamina tiles, Materials and Gear to farm). In All games every game shares one screen. */
export default function FarmScreen({ games, scope, open }: ModuleScreenProps) {
  const shown = useMemo(() => inScope(games, scope), [games, scope]);
  const lists = useGameLists(shown);
  if (!lists) return <p className={f.sub}>Loading characters…</p>;
  return (
    <WithUserData games={shown}>
      {(users) => {
        const rows: FarmGame[] = shown.flatMap((g) => {
          const l = lists[g.id];
          const user = users[g.id];
          return l && user ? [{ game: g, characters: l.characters, materials: l.materials, user }] : [];
        });
        return <Farm games={rows} openRoster={() => open('roster')} />;
      }}
    </WithUserData>
  );
}
