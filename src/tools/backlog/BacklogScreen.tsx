import { useState } from 'react';
import type { GameContract } from '../../core/contract';
import type { ModuleScreenProps } from '../../core/registry/modules';
import { Button, ExampleNotice, HowTo } from '../../core/ui';
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
          <>Backlog is permanent content you haven’t finished yet: the story, side quests, permanent events, exploration, modes and achievements. Pick a category with the tabs.</>,
          <>
            Mark your progress right on the list: tap the story step you are on, tick side quests, and set counters with − and + (or type the number the game shows). Until you
            do, an item says “No data yet” and isn’t counted.
          </>,
          <>
            Press <strong>Edit</strong> to change anything: rename items, set their totals and rewards, add your own items or categories, or hide what you don’t want. Hidden
            items can always be shown again; nothing is deleted.
          </>,
          <>
            The switch on each category decides whether it <strong>counts toward pulls</strong>. “Still on the table” adds up the switched-on categories; the same switches are in
            Pulls → Calculator.
          </>,
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
  const [editing, setEditing] = useState(false);
  if (data.loading) return null;
  return (
    <section className={b.stack} aria-label={game.name}>
      <div className={b.gameHead}>
        <GameHeading game={game} show={heading} />
        <Button variant={editing ? 'primary' : 'secondary'} onClick={() => setEditing((v) => !v)} aria-pressed={editing} aria-label={editing ? `Done editing ${game.name} backlog` : `Edit ${game.name} backlog`}>
          {editing ? '✓ Done editing' : 'Edit'}
        </Button>
      </div>
      {data.items.example && (
        <ExampleNotice actions={[{ label: 'Edit', onClick: () => setEditing(true) }]}>
          Items marked EXAMPLE stand in until the game’s backlog list is added (that part is on us, not you). They’re fully yours to use: change one in Edit and it becomes
          your own item; progress you enter is saved for real. Examples are never counted toward pulls.
        </ExampleNotice>
      )}
      <Backlog game={game} data={data} openCalculator={openCalculator} editing={editing} />
    </section>
  );
}
