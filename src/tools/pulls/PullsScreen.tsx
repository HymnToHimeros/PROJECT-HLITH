import type { ReactNode } from 'react';
import type { GameContract, ModuleId } from '../../core/contract';
import { useSession } from '../../core/auth/session';
import { backend } from '../../core/data/backend';
import type { ModuleScreenProps } from '../../core/registry/modules';
import { ExampleNotice, HowTo, useNow, type ExampleAction } from '../../core/ui';
import { BankLog } from './BankLog';
import { Calculator } from './Calculator';
import { History } from './History';
import { Planner } from './Planner';
import { GameHeading } from './shared';
import p from './pulls.module.css';
import { usePullsData } from './usePullsData';

/** Pulls module (Override 3): Planner, Calculator, Bank log, History. One block per game in scope. */
export default function PullsScreen({ games, scope, tab, servers, openTab, open, openAccount, openServer }: ModuleScreenProps) {
  const now = useNow(60_000);
  const signedIn = Boolean(useSession(backend));
  const shown = scope === 'all' ? games : games.filter((g) => g.id === scope);
  const current = tab ?? 'planner';
  return (
    <div className={p.page}>
      <HowTo title={`How to use the ${TAB_NAME[current] ?? 'Pulls'}`} steps={HOW[current] ?? HOW.planner ?? []} />
      {shown.map((g) => (
        <GamePulls key={g.id} game={g} tab={current} serverId={servers[g.id]} now={now} many={shown.length > 1} signedIn={signedIn} openTab={openTab} open={open} openAccount={openServer ? () => openServer(g.id) : openAccount} />
      ))}
    </div>
  );
}

const TAB_NAME: Record<string, string> = { planner: 'Planner', calculator: 'Calculator', log: 'Bank log', history: 'History' };

/** Every tab explains itself, for a player, not a programmer. */
const HOW: Record<string, ReactNode[]> = {
  planner: [
    <>Each card is one banner. “Have now” is what your current currency buys (from the Bank log). “By end” adds everything you can still earn before the banner ends: the same sums as the Calculator.</>,
    <>“Worst case” is how many pulls make the featured character 100% certain from your current pity: hard pity, and once more if you lose the 50/50. Most players get it sooner.</>,
    <>Green “Covers the worst case” means you’re safe even with the worst luck. Orange shows how many pulls you’re short.</>,
    <>
      Chance by then, “official rates”: only the numbers the game publishes (base rate, hard pity, 50/50). “Community rates”: adds the rising odds near pity that player trackers measured. It is usually
      higher but not official.
    </>,
    <>Chances need your pity. Import your history in the History tab, or type it into “Know your pity?” to try it out (that isn’t saved).</>,
    <>
      “Not counted” lists income HLITH can’t prove yet, for example because you haven’t picked your server or a reward amount isn’t known. Those rows are left out, never guessed, so your real total
      can only be higher.
    </>,
  ],
  calculator: [
    <>This adds up everything you can still get until the version ends: your bank now, dailies, weeklies, endgame, events and login events, and Backlog rewards if you switch them on.</>,
    <>Each row shows pulls in big numbers and the currency amount under it. “Known total” is the sum of the rows that have data.</>,
    <>Switches: paid extras (like a monthly pass) count only when switched on. Backlog categories count only when switched on; the same switches are in Backlog.</>,
    <>“No data yet” means HLITH can’t prove that amount yet (no server chosen, unknown reward, or the event list is still an example). It is left out of the total, never estimated.</>,
    <>Events you mark done in Events are already in your bank, so they stop counting here. Skipped events count zero.</>,
  ],
  log: [
    <>
      In the game, open the shop or your inventory: the top of the screen shows your premium currency and your pull passes (for example Stellar Jade and Star Rail Special Passes, or Polychrome
      and Encrypted Master Tapes).
    </>,
    <>Here pick “Balance check”, type those numbers exactly as the game shows them, and press Add entry. That becomes your bank.</>,
    <>Optional: log what you earn, buy or spend in between with the other kinds, and a note like “10 pulls”. A new balance check always resets the balance to what you typed.</>,
    <>Nothing is ever edited or deleted. If you made a mistake, just add a new balance check. The Planner and Calculator use the newest balance.</>,
  ],
  history: [
    <>Pick one way in below: paste the in-game history link, pick the game’s cache file (same link, no command), or upload an export file from another tracker.</>,
    <>Each way opens its own step-by-step guide. They work on PC; on phones and consoles there is no simple way (see the note under the choices).</>,
    <>Importing again only adds new pulls. Pulls are never changed or removed.</>,
    <>After importing you see your pity per banner, your Luck report and every top result with the pulls it took. The Planner then shows real chances.</>,
  ],
};

interface Props {
  game: GameContract;
  tab: string;
  serverId: string | undefined;
  now: number;
  many: boolean;
  signedIn: boolean;
  openTab: (tab: string) => void;
  open: (module: ModuleId, tab?: string) => void;
  openAccount: () => void;
}

function GamePulls({ game, tab, serverId, now, many, signedIn, openTab, open, openAccount }: Props) {
  const data = usePullsData(game, now);
  if (data.loading) return null;
  // Say exactly what is example and give a button that goes where you replace it.
  const parts: string[] = [];
  const actions: ExampleAction[] = [];
  const focus = (id: string) => () => document.getElementById(`${id}-${game.id}`)?.focus();
  if (tab === 'log') {
    if (data.bank.example) {
      parts.push('The balance and entries are examples. Your first entry replaces them.');
      actions.push({ label: 'Enter my currency', onClick: focus('bank-amount') });
    }
  } else if (tab === 'history') {
    if (data.history.example) {
      parts.push('The pity, luck and results are example pulls until you import yours.');
      actions.push({ label: 'Import a file', onClick: () => document.getElementById(`history-file-${game.id}`)?.click() });
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
    if (data.banners.example || data.versionEnd.example) parts.push('Banners and the version end date are examples until the game’s lists are added (that part is on us, not you).');
    if (data.notCounted.length) parts.push(`${data.notCounted.join(' and ')} rewards aren’t counted: those lists are still examples.`);
    if (!serverId) {
      parts.push('Daily and weekly income is left out until you pick your server.');
      actions.push({ label: 'Choose my server', onClick: openAccount });
    }
  }
  const anyExample = tab === 'log' ? data.bank.example : tab === 'history' ? data.history.example : data.bank.example || data.history.example || data.banners.example || data.versionEnd.example;
  return (
    <section className={p.stack} aria-label={game.name}>
      <GameHeading game={game} show={many} />
      {anyExample && <ExampleNotice actions={actions}>{parts.join(' ')}</ExampleNotice>}
      {tab === 'planner' && <Planner game={game} data={data} serverId={serverId} now={now} tagged={many} openTab={openTab} />}
      {tab === 'calculator' && <Calculator game={game} data={data} serverId={serverId} now={now} tagged={many} openModule={(m) => open(m)} />}
      {tab === 'log' && <BankLog game={game} data={data} />}
      {tab === 'history' && <History game={game} data={data} signedIn={signedIn} />}
    </section>
  );
}
