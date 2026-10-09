import type { GameContract } from '../../core/contract';
import type { ModuleScreenProps } from '../../core/registry/modules';
import { ExampleNotice, useNow, type ExampleAction } from '../../core/ui';
import { GameHeading } from '../pulls/shared';
import { Events } from './Events';
import e from './events.module.css';
import { useEventsData } from './useEventsData';

/** Events module: one block per game in scope. */
export default function EventsScreen({ games, scope, servers, openAccount }: ModuleScreenProps) {
  const now = useNow(60_000);
  const shown = scope === 'all' ? games : games.filter((g) => g.id === scope);
  return (
    <div className={e.stack}>
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
