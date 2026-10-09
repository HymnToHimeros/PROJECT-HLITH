import { useCallback, useState } from 'react';
import type { GameContract, ModuleId } from '../../core/contract';
import type { ModuleScreenProps } from '../../core/registry/modules';
import { BottomSheet, Button, ExampleNotice, type ExampleAction } from '../../core/ui';
import { CharacterPage } from './CharacterPage';
import { Characters } from './Characters';
import r from './roster.module.css';
import { entryOf, GameHeading } from './shared';
import { Teams } from './Teams';
import { useRosterData } from './useRosterData';

/** Roster module: Characters and Teams tabs. One block per game in scope. */
export default function RosterScreen({ games, scope, tab, openTab, open }: ModuleScreenProps) {
  const shown = scope === 'all' ? games : games.filter((g) => g.id === scope);
  return (
    <div className={r.stack}>
      {shown.map((g) => (
        <GameRoster key={g.id} game={g} tab={tab === 'teams' ? 'teams' : 'characters'} heading={shown.length > 1} openTab={openTab} open={open} />
      ))}
    </div>
  );
}

interface Props {
  game: GameContract;
  tab: 'characters' | 'teams';
  heading: boolean;
  openTab: (tab: string) => void;
  open: (module: ModuleId, tab?: string) => void;
}

function GameRoster({ game, tab, heading, openTab, open }: Props) {
  const data = useRosterData(game);
  const [selected, setSelected] = useState<string | null>(null);
  // Stable, so the open sheet keeps focus where you are while you change things in it.
  const close = useCallback(() => setSelected(null), []);
  if (data.loading) return null;
  const character = selected ? data.byId.get(selected) : undefined;

  const actions: ExampleAction[] = [];
  const ownsAnyone = data.characters.some((c) => entryOf(data.user.roster, c.id).owned);
  if (!ownsAnyone) actions.push({ label: 'Mark who I own', onClick: () => openTab('characters') });

  return (
    <section className={r.stack} aria-label={game.name}>
      <GameHeading game={game} show={heading} />
      {tab === 'teams' && data.presets.example && data.presets.list.length > 0 && (
        <ExampleNotice actions={actions}>
          The recommended teams are examples built from the {game.terms.character.toLowerCase()} list (a {game.terms.rarity.top} {game.terms.character.toLowerCase()} with others of the same element), not advice. Real recommended teams still have to be added by us. Your roster and your own teams are always yours.
        </ExampleNotice>
      )}
      {tab === 'characters' && <Characters game={game} data={data} onOpen={setSelected} />}
      {tab === 'teams' && <Teams game={game} data={data} onOpen={setSelected} openCharacters={() => openTab('characters')} />}
      <BottomSheet open={Boolean(character)} side title={character?.name ?? ''} onClose={close}>
        {character && (
          <div className={r.sheetBar}>
            <span className={r.muted}>{game.terms.character}</span>
            <Button variant="quiet" onClick={close}>
              Close
            </Button>
          </div>
        )}
        {character && <CharacterPage game={game} data={data} character={character} openPulls={game.modules.includes('pulls') ? () => open('pulls', 'planner') : undefined} />}
      </BottomSheet>
    </section>
  );
}
