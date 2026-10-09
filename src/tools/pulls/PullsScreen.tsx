import type { GameContract } from '../../core/contract';
import { useSession } from '../../core/auth/session';
import { backend } from '../../core/data/backend';
import type { ModuleScreenProps } from '../../core/registry/modules';
import { useNow } from '../../core/ui';
import { BankLog } from './BankLog';
import { Calculator } from './Calculator';
import { History } from './History';
import { Planner } from './Planner';
import { ExampleNotice, GameHeading } from './shared';
import p from './pulls.module.css';
import { usePullsData } from './usePullsData';

/** Pulls module (Override 3): Planner, Calculator, Bank log, History. One block per game in scope. */
export default function PullsScreen({ games, scope, tab, servers }: ModuleScreenProps) {
  const now = useNow(60_000);
  const signedIn = Boolean(useSession(backend));
  const shown = scope === 'all' ? games : games.filter((g) => g.id === scope);
  return (
    <div className={p.stack}>
      {shown.map((g) => (
        <GamePulls key={g.id} game={g} tab={tab ?? 'planner'} serverId={servers[g.id]} now={now} heading={shown.length > 1} signedIn={signedIn} />
      ))}
    </div>
  );
}

interface Props {
  game: GameContract;
  tab: string;
  serverId: string | undefined;
  now: number;
  heading: boolean;
  signedIn: boolean;
}

function GamePulls({ game, tab, serverId, now, heading, signedIn }: Props) {
  const data = usePullsData(game, now);
  if (data.loading) return null;
  const anyExample =
    tab === 'history' ? data.history.example : tab === 'log' ? data.bank.example : data.bank.example || data.history.example || data.banners.example || data.versionEnd.example;
  return (
    <section className={p.stack} aria-label={game.name}>
      <GameHeading game={game} show={heading} />
      {anyExample && <ExampleNotice />}
      {tab === 'planner' && <Planner game={game} data={data} serverId={serverId} now={now} />}
      {tab === 'calculator' && <Calculator game={game} data={data} serverId={serverId} now={now} />}
      {tab === 'log' && <BankLog game={game} data={data} />}
      {tab === 'history' && <History game={game} data={data} signedIn={signedIn} />}
    </section>
  );
}
