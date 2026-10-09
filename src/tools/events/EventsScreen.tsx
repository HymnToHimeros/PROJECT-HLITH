import type { GameContract } from '../../core/contract';
import type { ModuleScreenProps } from '../../core/registry/modules';
import { ExampleNotice, HowTo, useNow, type ExampleAction } from '../../core/ui';
import { GameHeading } from '../pulls/shared';
import { Events } from './Events';
import e from './events.module.css';
import { useEventsData } from './useEventsData';

/** Events module: one block per game in scope. */
export default function EventsScreen({ games, scope, servers, openAccount }: ModuleScreenProps) {
  const now = useNow(60_000);
  const shown = scope === 'all' ? games : games.filter((g) => g.id === scope);
  return (
    <div className={e.page}>
      <HowTo
        title="How to use Events"
        steps={[
          <>Every event, login event and endgame cycle that is running or coming up, with what it still gives you. The filter on top narrows the list.</>,
          <>
            Tap <strong>Done</strong> when you have finished an event: its reward is then already in your bank, so Pulls stops counting it. Tap <strong>Skip</strong> if you won’t play it: it counts
            zero. <strong>Open</strong> means you still plan to do it, so its reward counts as “still to earn”.
          </>,
          <>
            Login events: tap the bar at the day you are on (or use +1 day each day you log in). HLITH counts only the days you can still claim before the event ends. Tap the last day again, or −, to
            undo.
          </>,
          <>Endgame modes reset on a cycle; marking one done counts for this cycle only. A new cycle starts open again.</>,
          <>“Rewards left” adds up what the open events still give, in pulls. Rewards HLITH doesn’t know show “No data yet” and are left out, never guessed.</>,
        ]}
      />
      {shown.map((g) => (
        <GameEvents key={g.id} game={g} serverId={servers[g.id]} now={now} heading={shown.length > 1} openAccount={openAccount} />
      ))}
    </div>
  );
}

function GameEvents({ game, serverId, now, heading, openAccount }: { game: GameContract; serverId: string | undefined; now: number; heading: boolean; openAccount: () => void }) {
  const data = useEventsData(game, now);
  if (data.loading) return null;
  // Say exactly what is example, and that the event list is ours to add, not yours.
  const parts: string[] = [];
  const actions: ExampleAction[] = [];
  if (data.events.example) {
    parts.push('These events are examples: the game’s event list still has to be added by us (not you). Marking events done or skipped and claiming login days already saves for real.');
  }
  if (data.versionEnd.example) parts.push('The version end date is an example too, until the version list is added.');
  const anyExample = data.events.example || data.versionEnd.example;
  if (anyExample && !serverId) {
    parts.push('Login days left are not counted until you pick your server.');
    actions.push({ label: 'Choose my server', onClick: openAccount });
  }
  return (
    <section className={e.stack} aria-label={game.name}>
      <GameHeading game={game} show={heading} />
      {anyExample && <ExampleNotice actions={actions}>{parts.join(' ')}</ExampleNotice>}
      <Events game={game} data={data} serverId={serverId} now={now} onChooseServer={openAccount} />
    </section>
  );
}
