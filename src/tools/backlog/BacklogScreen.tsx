import type { GameContract } from '../../core/contract';
import type { ModuleScreenProps } from '../../core/registry/modules';
import { ExampleNotice, HowTo, type ExampleAction } from '../../core/ui';
import { GameHeading } from '../pulls/shared';
import { Backlog } from './Backlog';
import b from './backlog.module.css';
import { useBacklogData } from './useBacklogData';

/** Backlog module: one block per game in scope. */
export default function BacklogScreen({ games, scope, open }: ModuleScreenProps) {
  const shown = scope === 'all' ? games : games.filter((g) => g.id === scope);
  return (
    <div className={b.page}>
      <HowTo
        title="How to use Backlog"
        steps={[
          <>Backlog is permanent content you haven’t finished yet that still gives currency: story, side quests, exploration, modes and achievements.</>,
          <>Each row shows how far you are and how many pulls its rewards are still worth. Open a row (tap its name) to see the items in it.</>,
          <>Tap Edit on an item and set how much you have done, as the game shows it (for example 38 of 52 chapters). Until you do, it says “No data yet” and isn’t counted.</>,
          <>
            The switch on each row decides whether that category <strong>counts toward pulls</strong>. Switch off what you won’t play (for example Achievements) and it drops out of the Pulls
            Calculator and the Planner. The same switches are in Pulls → Calculator.
          </>,
          <>“Backlog could add” is the total of the switched-on rows. Open calculator to see it next to everything else you can still earn.</>,
        ]}
      />
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
