import { useEffect, useState } from 'react';
import type { GameContract, GameId, ModuleId } from '../../core/contract';
import { accountsFor, type LinkedAccount } from '../account-links/accounts';
import { hoyolabLink } from '../account-links/hoyolab';
import { useAccounts } from '../account-links/useAccounts';
import { updatePrefs, usePrefs } from '../../core/data/prefs';
import { hasServer, readReminders } from '../feeds/server';
import { useAppShell } from '../../core/shell/appShell';
import { Button } from '../../core/ui';
import { WithUserData } from '../today/lists';
import type { GameUserData } from '../../core/data/userData';
import a from './account.module.css';

export interface SetupStep {
  id: string;
  title: string;
  why: string;
  done: boolean;
  /** Can't be done in this copy of HLITH (why, in plain words): shown, never ticked; Skip it. */
  unavailable?: string;
  action: { label: string; onClick: () => void } | null;
}

interface Props {
  games: GameContract[];
  open: (module: ModuleId, tab?: string) => void;
  goTo: (page: 'game-settings' | 'notifications' | 'backup' | 'connections') => void;
}

export interface SetupFacts {
  /** Every linked HoYoLAB account, on the server or on this device. */
  accounts: LinkedAccount[];
  /** Your calendar link is on (read from HLITH's server). */
  feed: boolean;
  backup: boolean;
  /** HLITH's server is reachable for you (connected and signed in). */
  server: boolean;
  /** Opened as the installed app (home screen / own window), not in a browser tab. */
  installed?: boolean;
}

/** Each step ticks itself from your real data; nothing is ticked by hand (you can only Skip one). */
export function setupSteps(games: GameContract[], servers: Record<GameId, string>, data: Record<GameId, GameUserData>, extra: SetupFacts, act: Props): SetupStep[] {
  const noServer = 'Needs HLITH’s server and sign-in, which this copy doesn’t have.';
  const all = games.map((g) => data[g.id]).filter((d): d is GameUserData => Boolean(d));
  const serverOk = games.every((g) => g.servers.some((s) => s.id === servers[g.id]));
  return [
    { id: 'server', title: 'Choose your server', why: 'Resets and ticks follow your game server’s clock.', done: serverOk, action: { label: 'Choose server', onClick: () => act.goTo('game-settings') } },
    { id: 'bank', title: 'Enter your currency in the Bank log', why: 'Pulls available and the planner start from what you have.', done: all.some((d) => d.ledger.some((e) => e.kind === 'have')), action: { label: 'Open Bank log', onClick: () => act.open('pulls', 'log') } },
    { id: 'history', title: 'Import your pull history', why: 'Pity, guarantees and the luck report come from it.', done: all.some((d) => d.pulls.length > 0), action: { label: 'Open History', onClick: () => act.open('pulls', 'history') } },
    { id: 'owned', title: 'Mark the characters you own', why: 'Team fit, banner advice and Farm use your roster.', done: all.some((d) => Object.values(d.roster).some((r) => r.owned)), action: { label: 'Open Roster', onClick: () => act.open('roster', 'characters') } },
    // Ticks for any linked HoYoLAB account, saved on HLITH's server or remembered on this device.
    {
      id: 'hoyolab',
      title: 'Connect HoYoLAB',
      why: 'Live stamina, the daily check-in and character import.',
      done: games.some((g) => hoyolabLink(g) && accountsFor(extra.accounts, g.id).length > 0),
      ...(hasServer() ? {} : { unavailable: noServer }),
      action: { label: 'Open Connected accounts', onClick: () => act.goTo('connections') },
    },
    // The evening message can't be sent yet (no push on the server), so only the calendar feed ticks this.
    {
      id: 'notify',
      title: 'Set up notifications',
      why: 'A calendar feed so nothing ends unseen. The evening message is preview only for now.',
      done: extra.feed,
      ...(extra.server ? {} : { unavailable: noServer }),
      action: { label: 'Open Notifications', onClick: () => act.goTo('notifications') },
    },
    { id: 'backup', title: 'Download a backup', why: 'A backup file is a copy you hold yourself, on top of sync.', done: extra.backup, action: { label: 'Open Backup', onClick: () => act.goTo('backup') } },
    // Ticks when HLITH runs as the installed app; the steps are in the "Install HLITH as an app" card above.
    {
      id: 'install',
      title: 'Install HLITH as an app',
      why: 'Opens from your home screen in its own window, also offline.',
      done: Boolean(extra.installed),
      action: { label: 'How to install', onClick: () => document.getElementById('install-app')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) },
    },
  ];
}

/** Your calendar link is on: asked once from HLITH's server (false without one). */
function useFeedOn(ready: boolean): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    readReminders()
      .then((r) => alive && setOn(Boolean(r?.feed_enabled && r.feed_token)))
      .catch(() => alive && setOn(false));
    return () => {
      alive = false;
    };
  }, [ready]);
  return ready && on;
}

const setSkipped = (id: string, skip: boolean) =>
  updatePrefs((p) => {
    const cur = p.skippedSetup ?? [];
    return { ...p, skippedSetup: skip ? [...cur.filter((x) => x !== id), id] : cur.filter((x) => x !== id) };
  });

/** ★ Setup checklist (R55, no design yet: built from the shared tokens). */
export function SetupChecklist(props: Props) {
  const prefs = usePrefs();
  const { accounts, signedIn } = useAccounts(props.games);
  const server = hasServer() && signedIn;
  const feed = useFeedOn(server);
  const skipped = new Set(prefs.skippedSetup ?? []);
  const { installed } = useAppShell();
  return (
    <WithUserData games={props.games}>
      {(data) => {
        const steps = setupSteps(props.games, prefs.servers, data, { accounts, feed, backup: Boolean(prefs.lastBackupAt), server, installed }, props);
        const done = steps.filter((s) => s.done).length;
        const skips = steps.filter((s) => !s.done && skipped.has(s.id)).length;
        const handled = done + skips;
        return (
          <section className={a.card} aria-label="Setup checklist">
            <div className={a.head}>
              <h3 className={a.cardTitle} style={{ flex: 1 }}>
                Setup checklist
              </h3>
              <span className={a.mono}>
                {handled}/{steps.length}
                {skips > 0 && ` · ${skips} skipped`}
              </span>
            </div>
            <div className={a.track2} role="progressbar" aria-label="Setup done" aria-valuenow={handled} aria-valuemin={0} aria-valuemax={steps.length}>
              <div className={a.fill} style={{ width: `${(handled / steps.length) * 100}%` }} />
            </div>
            <p className={a.small}>Do these in order and almost everything fills itself in. Steps tick themselves when HLITH can see they’re done. Skip the ones you don’t need.</p>
            <div>
              {steps.map((s) => {
                const isSkipped = !s.done && skipped.has(s.id);
                return (
                  <div key={s.id} className={a.check}>
                    <span className={s.done ? `${a.box} ${a.boxDone}` : a.box} aria-hidden="true">
                      {s.done ? '✓' : isSkipped ? '–' : ''}
                    </span>
                    <span className={a.checkText}>
                      <span className={s.done || isSkipped ? a.done : undefined} style={{ fontSize: 14, fontWeight: 600, color: s.done || isSkipped ? undefined : 'var(--ink-1)' }}>
                        {s.title}
                        <span className="visually-hidden">{s.done ? ' (done)' : isSkipped ? ' (skipped)' : s.unavailable ? ' (not possible here)' : ' (to do)'}</span>
                      </span>
                      <span>{s.why}</span>
                      {s.unavailable && !s.done && <span>{s.unavailable}</span>}
                    </span>
                    {!s.done && !isSkipped && !s.unavailable && s.action && <Button onClick={s.action.onClick}>{s.action.label}</Button>}
                    {!s.done &&
                      (isSkipped ? (
                        <Button variant="quiet" onClick={() => setSkipped(s.id, false)} aria-label={`Undo skip: ${s.title}`}>
                          Undo skip
                        </Button>
                      ) : (
                        <Button variant="quiet" onClick={() => setSkipped(s.id, true)} aria-label={`Skip: ${s.title}`}>
                          Skip
                        </Button>
                      ))}
                  </div>
                );
              })}
            </div>
          </section>
        );
      }}
    </WithUserData>
  );
}
