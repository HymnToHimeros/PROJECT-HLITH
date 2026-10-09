import { useMemo, useState } from 'react';
import type { ModuleScreenProps } from '../../core/registry/modules';
import { CharacterPage } from './CharacterPage';
import { Characters } from './Characters';
import r from './roster.module.css';
import { WithUserData } from './shared';
import { Teams } from './Teams';
import { useRosterLists, type RosterData } from './useRosterData';

type Tab = 'characters' | 'teams';

/**
 * Roster module (design: Roster → Characters | Teams, and the character page).
 * In All games every game shares one grid, each tile carrying its game tag.
 * Opening a character replaces the grid with its page, with "← Roster" back.
 */
export default function RosterScreen({ games, scope, tab, openTab, open }: ModuleScreenProps) {
  const shown = useMemo(() => (scope === 'all' ? games : games.filter((g) => g.id === scope)), [games, scope]);
  const lists = useRosterLists(shown);
  const current: Tab = tab === 'teams' ? 'teams' : 'characters';
  // The open character belongs to the tab it was opened from; switching tabs goes back to that tab's list.
  const [page, setPage] = useState<{ tab: Tab; game: string; id: string } | null>(null);
  if (!lists) return <p className={r.muted}>Loading characters…</p>;

  return (
    <WithUserData games={shown}>
      {(users) => {
        const data: RosterData[] = shown.flatMap((g) => {
          const l = lists[g.id];
          const user = users[g.id];
          return l && user ? [{ ...l, game: g, user }] : [];
        });
        const several = data.length > 1;
        const openPage = (game: string, id: string) => setPage({ tab: current, game, id });
        const pageData = page && page.tab === current ? data.find((d) => d.game.id === page.game) : undefined;
        const character = page && pageData?.byId.get(page.id);
        if (pageData && character) {
          return (
            <CharacterPage
              key={`${pageData.game.id}:${character.id}`}
              data={pageData}
              character={character}
              several={several}
              onBack={() => setPage(null)}
              openPulls={pageData.game.modules.includes('pulls') ? (t) => open('pulls', t) : undefined}
              openFarm={pageData.game.modules.includes('farm') ? () => open('farm') : undefined}
            />
          );
        }
        return current === 'teams' ? (
          <Teams data={data} several={several} onOpen={openPage} openCharacters={() => openTab('characters')} />
        ) : (
          <Characters data={data} several={several} onOpen={openPage} />
        );
      }}
    </WithUserData>
  );
}
