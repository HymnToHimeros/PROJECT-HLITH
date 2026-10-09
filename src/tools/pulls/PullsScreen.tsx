import type { GameContract } from '../../core/contract';
import { useSession } from '../../core/auth/session';
import { backend } from '../../core/data/backend';
import type { ModuleScreenProps } from '../../core/registry/modules';
import { ExampleNotice, useNow, type ExampleAction } from '../../core/ui';
import { BankLog } from './BankLog';
import { Calculator } from './Calculator';
import { History } from './History';
import { Planner } from './Planner';
import { GameHeading } from './shared';
import p from './pulls.module.css';
import { usePullsData } from './usePullsData';

/** Pulls module (Override 3): Planner, Calculator, Bank log, History. One block per game in scope. */
export default function PullsScreen({ games, scope, tab, servers, openTab, openAccount }: ModuleScreenProps) {
  const now = useNow(60_000);
  const signedIn = Boolean(useSession(backend));
  const shown = scope === 'all' ? games : games.filter((g) => g.id === scope);
  return (
    <div className={p.stack}>
      {shown.map((g) => (
        <GamePulls key={g.id} game={g} tab={tab ?? 'planner'} serverId={servers[g.id]} now={now} heading={shown.length > 1} signedIn={signedIn} openTab={openTab} openAccount={openAccount} />
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
  openTab: (tab: string) => void;
  openAccount: () => void;
}

function GamePulls({ game, tab, serverId, now, heading, signedIn, openTab, openAccount }: Props) {
  const data = usePullsData(game, now);
  if (data.loading) return null;
  // Say exactly what is example and give a button that goes where you replace it.
  const parts: string[] = [];
  const actions: ExampleAction[] = [];
  const focus = (id: string) => () => document.getElementById(`${id}-${game.id}`)?.focus();
  if (tab === 'log') {
    if (data.bank.example) {
      parts.push('Type what you have in game into the form below; your first entry replaces the example balance.');
      actions.push({ label: 'Enter my currency', onClick: focus('bank-amount') });
    }
  } else if (tab === 'history') {
    if (data.history.example) {
      parts.push('Import your pull history below and the example pulls disappear.');
      actions.push({ label: 'Import my history', onClick: focus('history-file') });
    }
  } else {
    if (data.bank.example) {
      parts.push('Your currency is an example.');
      actions.push({ label: 'Enter my currency', onClick: () => openTab('log') });
    }
    if (data.history.example) {
      parts.push('Pity comes from example pulls.');
      actions.push({ label: 'Import my history', onClick: () => openTab('history') });
    }
    if (data.banners.example || data.versionEnd.example) parts.push('Banners and the version end date are examples until the game’s banner list is added (that part is on us, not you).');
    if (!serverId) {
      parts.push('Daily and weekly income is left out until you pick your server.');
      actions.push({ label: 'Choose my server', onClick: openAccount });
    }
  }
  const anyExample = tab === 'log' ? data.bank.example : tab === 'history' ? data.history.example : data.bank.example || data.history.example || data.banners.example || data.versionEnd.example;
  return (
    <section className={p.stack} aria-label={game.name}>
      <GameHeading game={game} show={heading} />
      {anyExample && <ExampleNotice actions={actions}>{parts.join(' ')}</ExampleNotice>}
      {tab === 'planner' && <Planner game={game} data={data} serverId={serverId} now={now} />}
      {tab === 'calculator' && <Calculator game={game} data={data} serverId={serverId} now={now} />}
      {tab === 'log' && <BankLog game={game} data={data} />}
      {tab === 'history' && <History game={game} data={data} signedIn={signedIn} />}
    </section>
  );
}
