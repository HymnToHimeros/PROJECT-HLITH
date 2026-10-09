import type { GameContract, GameId, ModuleId } from '../../core/contract';
import { hoyolabLink, savedLogin } from '../account-links/hoyolab';
import { usePrefs } from '../../core/data/prefs';
import { Button } from '../../core/ui';
import { WithUserData } from '../today/lists';
import type { GameUserData } from '../../core/data/userData';
import a from './account.module.css';

export interface SetupStep {
  id: string;
  title: string;
  why: string;
  done: boolean;
  /** Not built yet: shown, never ticked. */
  unavailable?: boolean;
  action: { label: string; onClick: () => void } | null;
}

interface Props {
  games: GameContract[];
  open: (module: ModuleId, tab?: string) => void;
  goTo: (page: 'game-settings' | 'notifications' | 'backup' | 'connections') => void;
}

/** Each step ticks itself from your real data; nothing is ticked by hand. */
export function setupSteps(games: GameContract[], servers: Record<GameId, string>, data: Record<GameId, GameUserData>, extra: { notify: boolean; backup: boolean }, act: Props): SetupStep[] {
  const all = games.map((g) => data[g.id]).filter((d): d is GameUserData => Boolean(d));
  const serverOk = games.every((g) => g.servers.some((s) => s.id === servers[g.id]));
  return [
    { id: 'server', title: 'Choose your server', why: 'Resets and ticks follow your game server’s clock.', done: serverOk, action: { label: 'Choose server', onClick: () => act.goTo('game-settings') } },
    { id: 'bank', title: 'Enter your currency in the Bank log', why: 'Pulls available and the planner start from what you have.', done: all.some((d) => d.ledger.some((e) => e.kind === 'have')), action: { label: 'Open Bank log', onClick: () => act.open('pulls', 'log') } },
    { id: 'history', title: 'Import your pull history', why: 'Pity, guarantees and the luck report come from it.', done: all.some((d) => d.pulls.length > 0), action: { label: 'Open History', onClick: () => act.open('pulls', 'history') } },
    { id: 'owned', title: 'Mark the characters you own', why: 'Team fit, banner advice and Farm use your roster.', done: all.some((d) => Object.values(d.roster).some((r) => r.owned)), action: { label: 'Open Roster', onClick: () => act.open('roster', 'characters') } },
    // Ticks when a HoYoLAB login is remembered on this device (the default is use-once, so it can stay open).
    { id: 'hoyolab', title: 'Connect HoYoLAB', why: 'Live stamina, the daily check-in and character import.', done: games.some((g) => hoyolabLink(g) && savedLogin(g.id)), action: { label: 'Open Connected accounts', onClick: () => act.goTo('connections') } },
    { id: 'notify', title: 'Set up notifications', why: 'An evening message and a calendar feed so nothing ends unseen.', done: extra.notify, action: { label: 'Open Notifications', onClick: () => act.goTo('notifications') } },
    { id: 'backup', title: 'Download a backup', why: 'Your game data lives on this device: a backup keeps it safe.', done: extra.backup, action: { label: 'Open Backup', onClick: () => act.goTo('backup') } },
  ];
}

/** ★ Setup checklist (R55, no design yet: built from the shared tokens). */
export function SetupChecklist(props: Props) {
  const prefs = usePrefs();
  return (
    <WithUserData games={props.games}>
      {(data) => {
        const steps = setupSteps(props.games, prefs.servers, data, { notify: Boolean(prefs.notify?.enabled), backup: Boolean(prefs.lastBackupAt) }, props);
        const done = steps.filter((s) => s.done).length;
        return (
          <section className={a.card} aria-label="Setup checklist">
            <div className={a.head}>
              <h3 className={a.cardTitle} style={{ flex: 1 }}>
                Setup checklist
              </h3>
              <span className={a.mono}>
                {done}/{steps.length}
              </span>
            </div>
            <div className={a.track2} role="progressbar" aria-label="Setup done" aria-valuenow={done} aria-valuemin={0} aria-valuemax={steps.length}>
              <div className={a.fill} style={{ width: `${(done / steps.length) * 100}%` }} />
            </div>
            <p className={a.small}>Do these in order and almost everything fills itself in. Steps tick themselves when HLITH can see they’re done.</p>
            <div>
              {steps.map((s) => (
                <div key={s.id} className={a.check}>
                  <span className={s.done ? `${a.box} ${a.boxDone}` : a.box} aria-hidden="true">
                    {s.done ? '✓' : ''}
                  </span>
                  <span className={a.checkText}>
                    <span className={s.done ? a.done : undefined} style={{ fontSize: 14, fontWeight: 600, color: s.done ? undefined : 'var(--ink-1)' }}>
                      {s.title}
                      <span className="visually-hidden">{s.done ? ' (done)' : s.unavailable ? ' (not available yet)' : ' (to do)'}</span>
                    </span>
                    <span>{s.why}</span>
                  </span>
                  {!s.done && s.action && <Button onClick={s.action.onClick}>{s.action.label}</Button>}
                  {s.unavailable && <span className={a.small}>Not available yet</span>}
                </div>
              ))}
            </div>
          </section>
        );
      }}
    </WithUserData>
  );
}
