import type { GameContract } from '../../core/contract';
import type { ModuleScreenProps } from '../../core/registry/modules';
import { ExampleNotice, type ExampleAction } from '../../core/ui';
import { GameHeading } from '../pulls/shared';
import { Backlog } from './Backlog';
import b from './backlog.module.css';
import { useBacklogData } from './useBacklogData';

/** Backlog module: one block per game in scope. */
export default function BacklogScreen({ games, scope, open }: ModuleScreenProps) {
  const shown = scope === 'all' ? games : games.filter((g) => g.id === scope);
  return (
    <div className={b.stack}>
      {shown.map((g) => (
        <GameBacklog key={g.id} game={g} heading={shown.length > 1} openCalculator={() => open('pulls', 'calculator')} />
      ))}
    </div>
  );
}

function GameBacklog({ game, heading, openCalculator }: { game: GameContract; heading: boolean; openCalculator: () => void }) {
  const data = useBacklogData(game);
  if (data.loading) return null;
  const actions: ExampleAction[] = [{ label: 'Enter my progress', onClick: () => document.getElementById(`backlog-first-${game.id}`)?.click() }];
  return (
    <section className={b.stack} aria-label={game.name}>
      <GameHeading game={game} show={heading} />
      {data.items.example && (
        <ExampleNotice actions={actions}>
          This backlog is an example: the game’s backlog list still has to be added by us (not you). The done counts are examples too until you enter your own. Tap
          any item to set how much you’ve done; that is saved for real.
        </ExampleNotice>
      )}
      <Backlog game={game} data={data} openCalculator={openCalculator} />
    </section>
  );
}
