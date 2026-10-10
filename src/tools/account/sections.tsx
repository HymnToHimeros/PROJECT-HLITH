import { useEffect, useState } from 'react';
import type { GameContract, GameId } from '../../core/contract';
import { BACKUP_EVERY_DAYS, daysSinceBackup, downloadBackup, parseBackup, restoreBackup, summarize, type Backup } from '../../core/data/backup';
import { updatePrefs, usePrefs } from '../../core/data/prefs';
import { canSync, syncNow, type SyncStatus } from '../../core/data/sync';
import { ServerPicker } from '../../core/shell/ServerPicker';
import { ProtagonistPicker } from '../../core/shell/ProtagonistPicker';
import { setTheme, THEMES, themeInfo } from '../../core/theme/theme';
import { ThemeMotif } from '../../core/theme/ThemeArt';
import { formatDate, formatTime } from '../../core/time/reset';
import { Button, HowTo } from '../../core/ui';
import { callFunction, hasServer, type DeletionRequest } from '../feeds/server';
import a from './account.module.css';
import { ago, Card, Switch } from './parts';

/*
 * The Account page's settings sections (Sync, Backup, Game settings, Theme, Sign in).
 * They were the sub-pages of the old Account sheet; the page draws them now.
 */

export function syncSub(status: SyncStatus, now: number): string {
  if (status.state === 'synced') {
    const min = Math.floor((now - status.at) / 60_000);
    return `Last sync ${min < 1 ? 'just now' : `${min} min ago`} · tap to sync now`;
  }
  if (status.state === 'syncing') return 'Syncing…';
  if (status.state === 'failed') return 'Sync failed · your changes are saved on this device';
  if (status.state === 'signed-out') return 'Signed out';
  return 'This device only · nothing leaves this browser';
}

export function SyncPage({ status, now, signedIn }: { status: SyncStatus; now: number; signedIn: boolean }) {
  const [busy, setBusy] = useState(false);
  const ok = status.state === 'synced';
  return (
    <>
      <Card title="Status">
        <span className={a.status} role="status">
          <span className={`${a.dot} ${ok ? a.dotOk : status.state === 'failed' ? a.dotWarn : ''}`} aria-hidden="true" />
          {status.state === 'synced' ? `Synced at ${formatTime(status.at)}` : syncSub(status, now)}
        </span>
        {status.state === 'failed' && <p className={`${a.small} ${a.warn}`}>{status.message}</p>}
        <div className={a.actions}>
          <Button
            variant="primary"
            disabled={!canSync() || busy}
            onClick={() => {
              setBusy(true);
              void syncNow().finally(() => setBusy(false));
            }}
          >
            {busy ? 'Syncing…' : 'Sync now'}
          </Button>
        </div>
        {!canSync() && <p className={a.small}>{signedIn ? 'Sync starts by itself a moment after you sign in.' : 'Sync needs sign-in. This site runs in “this device only” mode, so everything stays in this browser.'}</p>}
      </Card>
      <Card title="What syncs">
        <p className={a.text}>Everything syncs to your account: your settings (games, layout, servers, theme, notifications) and your game data (bank log, pull history, roster, teams, events, backlog, ticks, your own items and plans).</p>
        <p className={a.text}>When two devices disagree, the newest copy wins; the other one is kept as a backup in this browser, never thrown away. A backup file is still the safest copy you can hold yourself.</p>
      </Card>
      <HowTo steps={['Sign in on every device with the same account.', 'Changes sync a moment after you make them. “Sync now” sends them straight away.', 'If sync fails, nothing is lost: your changes stay on this device and sync next time.']} />
    </>
  );
}

export function BackupPage({ now, signedIn }: { now: number; signedIn: boolean }) {
  const prefs = usePrefs();
  const [picked, setPicked] = useState<{ backup: Backup; name: string } | null>(null);
  const [message, setMessage] = useState<{ tone: 'good' | 'warn'; text: string } | null>(null);
  const days = daysSinceBackup(now);

  const onFile = async (file: File | undefined) => {
    setMessage(null);
    setPicked(null);
    if (!file) return;
    const parsed = parseBackup(await file.text());
    if (!parsed.ok) setMessage({ tone: 'warn', text: parsed.error });
    else setPicked({ backup: parsed.backup, name: file.name });
  };
  const summary = picked ? summarize(picked.backup) : null;

  return (
    <>
      <Card title="Export my data">
        <p className={a.text}>Downloads one file with everything HLITH keeps for you in this browser: settings, bank log, pull history, roster, events, backlog, teams and ticks.</p>
        <p className={a.small} role="status">
          {days === null ? 'No backup yet.' : `Last backup ${ago(prefs.lastBackupAt ?? now, now)}.`}
          {days !== null && days >= BACKUP_EVERY_DAYS ? ' Time for a new one.' : ''}
        </p>
        <div className={a.actions}>
          <Button variant="primary" onClick={() => setMessage({ tone: 'good', text: `Saved ${downloadBackup()}. Keep it somewhere safe.` })}>
            Export my data
          </Button>
        </div>
        <Switch label="Remind me to back up" hint={`Account shows “time for a new one” after ${BACKUP_EVERY_DAYS} days.`} checked={prefs.backupReminder !== false} onChange={(on) => updatePrefs((p) => ({ ...p, backupReminder: on }))} />
      </Card>

      <Card title="Restore from a backup file">
        <p className={a.text}>Adds what’s in the file to what’s already here. Nothing here is removed or overwritten: where both have a value, yours on this device stays.</p>
        <input className={a.input} type="file" accept="application/json,.json" aria-label="Choose a backup file" onChange={(e) => void onFile(e.target.files?.[0])} />
        {summary && picked && (
          <>
            <p className={a.small}>
              {picked.name} · made {formatDate(Date.parse(summary.exportedAt))}
            </p>
            <ul className={a.small} style={{ margin: 0, paddingLeft: '1.2em' }}>
              {summary.games.length === 0 && <li>No game data in this file, only settings.</li>}
              {summary.games.map((g) => (
                <li key={g.id}>
                  {g.id.toUpperCase()}: {g.bank} bank entries, {g.pulls} pulls, {g.roster} characters, {g.teams} teams
                </li>
              ))}
            </ul>
            <div className={a.actions}>
              <Button
                variant="primary"
                onClick={() => {
                  const added = restoreBackup(picked.backup);
                  setPicked(null);
                  setMessage({ tone: 'good', text: added ? `Added ${added} item${added === 1 ? '' : 's'} from the backup. Nothing was removed.` : 'Everything in this backup is already here. Nothing changed.' });
                }}
              >
                Add to my data
              </Button>
              <Button onClick={() => setPicked(null)}>Cancel</Button>
            </div>
          </>
        )}
        {message && (
          <p className={`${a.small} ${message.tone === 'good' ? a.good : a.warn}`} role="status">
            {message.text}
          </p>
        )}
      </Card>

      <ServerCopy signedIn={signedIn} />
      <DeleteAccount signedIn={signedIn} />

      <HowTo
        steps={[
          'Press “Export my data”. A file named HLITH-backup-(date).json lands in your downloads.',
          'Keep it somewhere safe (cloud drive, email to yourself).',
          'On a new device: Account → Backup → Restore, choose the file, check the summary, press “Add to my data”.',
          'Restoring twice is harmless: it only adds what’s missing.',
        ]}
      />
    </>
  );
}

function ServerCopy({ signedIn }: { signedIn: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!hasServer() || !signedIn) return null;
  const download = async () => {
    setBusy(true);
    setError('');
    try {
      const data = await callFunction<unknown>('export-data', {});
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `HLITH-account-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1_000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The download didn’t work.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card title="Your account’s copy">
      <p className={a.text}>Everything your account holds on HLITH’s server, table by table. Secrets like your calendar link are left out.</p>
      <div className={a.actions}>
        <Button disabled={busy} onClick={() => void download()}>
          {busy ? 'Preparing…' : 'Download my account data'}
        </Button>
      </div>
      {error && <p className={`${a.small} ${a.warn}`}>{error}</p>}
    </Card>
  );
}

function DeleteAccount({ signedIn }: { signedIn: boolean }) {
  const [step, setStep] = useState<'idle' | 'confirm'>('idle');
  const [word, setWord] = useState('');
  const [request, setRequest] = useState<DeletionRequest | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const live = hasServer() && signedIn;

  useEffect(() => {
    if (!live) return;
    callFunction<{ request: DeletionRequest | null }>('delete-account', { action: 'status' })
      .then((r) => setRequest(r.request))
      .catch(() => {});
  }, [live]);

  const act = async (body: Record<string, string>) => {
    setBusy(true);
    setError('');
    try {
      const r = await callFunction<{ request: DeletionRequest | null }>('delete-account', body);
      setRequest(r.request);
      setStep('idle');
      setWord('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That didn’t work. Nothing was changed.');
    } finally {
      setBusy(false);
    }
  };

  const pending = request && !request.cancelled_at && !request.completed_at;
  return (
    <Card title="Delete my account" danger>
      {!live ? (
        <p className={a.text}>
          There is no account to delete: this site runs in “this device only” mode and your data lives only in this browser. To remove it, export a backup first if you
          want one, then clear this site’s data in your browser settings.
        </p>
      ) : pending ? (
        <>
          <p className={a.text} role="status">
            Deletion requested on {formatDate(Date.parse(request.requested_at))}. Your account and its data are removed after {formatDate(Date.parse(request.purge_after))}.
            Until then you can still sign in, export everything, or change your mind.
          </p>
          <div className={a.actions}>
            <Button variant="primary" disabled={busy} onClick={() => void act({ action: 'cancel' })}>
              Keep my account
            </Button>
          </div>
        </>
      ) : step === 'idle' ? (
        <>
          <p className={a.text}>Removes your account and everything it holds on HLITH’s server after a 30-day grace period. Download your data first: it can’t be brought back afterwards.</p>
          <div className={a.actions}>
            <button type="button" className={a.dangerBtn} onClick={() => setStep('confirm')}>
              Delete my account…
            </button>
          </div>
        </>
      ) : (
        <>
          <p className={a.text}>
            Sure? Nothing is removed today. In 30 days your settings, bank log, pulls, roster, plans and reminders on the server are deleted for good. Data in this
            browser stays until you clear it.
          </p>
          <label className={a.switchRow}>
            <span className={a.switchText}>Type DELETE to confirm</span>
            <input className={a.input} value={word} onChange={(e) => setWord(e.target.value)} aria-label="Type DELETE to confirm" autoComplete="off" />
          </label>
          <div className={a.actions}>
            <button type="button" className={a.dangerBtn} disabled={word !== 'DELETE' || busy} onClick={() => void act({ action: 'request', confirm: 'DELETE' })}>
              Request deletion
            </button>
            <Button onClick={() => setStep('idle')}>Cancel</Button>
          </div>
        </>
      )}
      {error && (
        <p className={`${a.small} ${a.warn}`} role="alert">
          {error}
        </p>
      )}
    </Card>
  );
}

function taskRows(game: GameContract): { id: string; label: string }[] {
  const income = game.income
    .filter((r) => !r.paid && (r.schedule.kind === 'per-reset' || r.schedule.kind === 'weekly'))
    .map((r) => ({ id: `income:${r.id}`, label: `${r.label} · ${r.schedule.kind === 'weekly' ? 'weekly' : 'daily'}` }));
  return [...income, ...game.stamina.map((p) => ({ id: `stamina:${p.id}`, label: `Spend ${p.name} · daily` }))];
}

export function GameSettingsPage({ games, allGames, now, focus, onBack }: { games: GameContract[]; allGames: GameContract[]; now: number; focus?: GameId | undefined; onBack?: (() => void) | undefined }) {
  const prefs = usePrefs();
  const chosen = (prefs.games ?? allGames.map((g) => g.id)).filter((id) => allGames.some((g) => g.id === id));
  const hidden = prefs.hiddenTasks ?? {};
  const setHidden = (game: GameId, id: string, show: boolean) =>
    updatePrefs((p) => {
      const cur = p.hiddenTasks?.[game] ?? [];
      return { ...p, hiddenTasks: { ...p.hiddenTasks, [game]: show ? cur.filter((x) => x !== id) : [...new Set([...cur, id])] } };
    });
  return (
    <>
      <Card title="Server, per game">
        <p className={a.small}>Resets follow the game’s server, not your clock. Each option shows its daily reset in your time.</p>
        {/* Opened from a "Choose server" button: that game's picker comes first, marked. */}
        {[...games].sort((x, y) => Number(y.id === focus) - Number(x.id === focus)).map((g) => (
          <div key={g.id} className={g.id === focus ? a.focus : undefined}>
            <ServerPicker game={g} value={prefs.servers[g.id]} now={now} legend onChange={(id) => updatePrefs((p) => ({ ...p, servers: { ...p.servers, [g.id]: id } }))} />
          </div>
        ))}
        {focus && onBack && games.some((g) => g.id === focus) && (
          <div className={a.actions}>
            <Button variant={prefs.servers[focus] ? 'primary' : 'secondary'} onClick={onBack}>
              Done · back to where you were
            </Button>
          </div>
        )}
        <Switch label="Show server time" hint="A small clock next to each screen’s title." checked={Boolean(prefs.showServerTime)} onChange={(on) => updatePrefs((p) => ({ ...p, showServerTime: on }))} />
      </Card>
      {games.some((g) => g.protagonist) && (
        <Card title="Your main character">
          <p className={a.small}>Pick yours: their entries count as owned in Roster and teams, and the other one is hidden everywhere. Switching back shows them again; nothing is deleted.</p>
          {games.map((g) => (
            <ProtagonistPicker key={g.id} game={g} legend />
          ))}
        </Card>
      )}
      <Card title="Your games">
        <p className={a.small}>Games in the switcher. Turning one off never deletes its data.</p>
        {allGames.map((g) => {
          const on = chosen.includes(g.id);
          return (
            <Switch
              key={g.id}
              label={g.name}
              vent={g.vent}
              checked={on}
              disabled={on && chosen.length === 1}
              onChange={() => updatePrefs((p) => ({ ...p, games: on ? chosen.filter((id) => id !== g.id) : allGames.map((r) => r.id).filter((id) => id === g.id || chosen.includes(id)) }))}
            />
          );
        })}
      </Card>
      <Card title="Tasks on Today">
        <p className={a.small}>Switch off what you never do. It leaves Today and the evening message; your ticks are kept.</p>
        <Switch label="Hide ticked tasks on Today" checked={Boolean(prefs.hideTicked)} onChange={(on) => updatePrefs((p) => ({ ...p, hideTicked: on }))} />
        {games.map((g) => (
          <div key={g.id} className={a.stack} style={{ gap: 4 }}>
            <span className={a.label}>{g.short}</span>
            {taskRows(g).length === 0 && <p className={a.small}>The game record lists no daily or weekly tasks yet.</p>}
            {taskRows(g).map((t) => (
              <Switch key={t.id} label={t.label} vent={g.vent} checked={!(hidden[g.id] ?? []).includes(t.id)} onChange={(show) => setHidden(g.id, t.id, show)} />
            ))}
          </div>
        ))}
      </Card>
      <HowTo steps={['Pick your server for each game: the one you chose when you made your account in the game.', 'Switch off games you don’t play; they leave the switcher but keep their data.', 'Switch off tasks you never do so Today only shows what matters to you.']} />
    </>
  );
}

/**
 * Account → Example data: one switch that hides every example everywhere, so only your
 * own data and the games' real lists show, and brings them back again. It only changes
 * what's on screen: nothing you entered is touched either way.
 */
export function ExamplesPage() {
  const prefs = usePrefs();
  const shown = !prefs.hideExamples;
  return (
    <>
      <Card title="Example data">
        <p className={a.small}>
          While a list is still empty, HLITH shows clearly marked examples (with an EXAMPLE badge) so you can see what each screen does. Hide them to work only with your
          own data: empty places then say “No data yet”. Show them again any time to get the examples back.
        </p>
        <Switch
          label="Show example data"
          hint={shown ? 'On: examples fill the places that have no data yet.' : 'Off: only your own data and the games’ real lists. Empty places say “No data yet”.'}
          checked={shown}
          onChange={(on) => updatePrefs((p) => ({ ...p, hideExamples: !on }))}
        />
        <p className={a.small}>Nothing you entered is changed or removed either way: this only switches what you see.</p>
      </Card>
      <HowTo steps={['Switch “Show example data” off to hide every example on every screen.', 'Fill in your own data; it shows exactly as it will stay.', 'Switch it on again to see the examples next to empty places.']} />
    </>
  );
}

export function ThemePage() {
  const theme = themeInfo(usePrefs().theme).id;
  return (
    <>
      <div className={a.themeGrid} role="radiogroup" aria-label="Theme">
        {THEMES.map((t) => (
          <button key={t.id} type="button" role="radio" aria-checked={theme === t.id} className={a.themeCard} onClick={() => setTheme(t.id)}>
            {/* A small live preview, drawn with that theme's own colours. */}
            <span className={a.themePreview} data-theme-preview={t.id} aria-hidden="true">
              <ThemeMotif theme={t.id} className={a.themeMotif} />
              <span className={a.miniCard}>
                <span className={a.miniTitle}>Aa</span>
                <span className={a.miniLine} />
                <span className={`${a.miniLine} ${a.miniShort}`} />
                <span className={a.miniDots}>
                  <i style={{ background: 'var(--vent-all)' }} />
                  <i style={{ background: 'var(--glacier)' }} />
                  <i style={{ background: 'var(--ok)' }} />
                  <i style={{ background: 'var(--ember)' }} />
                </span>
              </span>
            </span>
            <span className={a.themeMeta}>
              <span className={a.ring} aria-hidden="true" />
              <span className={a.rowText}>
                <span className={a.rowTitle}>{t.name}</span>
                <span className={a.rowSub}>{t.mood}</span>
              </span>
            </span>
          </button>
        ))}
      </div>
      <p className={a.small}>
        Changes straight away. Saved with your settings, so it follows you to other devices once you sign in. Game colours stay the same in every theme, and
        the background art never sits under your cards or makes text harder to read.
      </p>
    </>
  );
}

export function SignInPage() {
  return (
    <Card title="Sign in isn’t switched on here">
      <p className={a.text}>This copy of HLITH runs in “this device only” mode: no server is connected, so there is no account to sign in to. Everything you enter stays in this browser.</p>
      <p className={a.text}>When sign-in is switched on you can use Google, Discord or an email link, and your settings follow you to every device.</p>
      <p className={a.small}>Until then: Account → Backup → Export my data keeps a copy safe.</p>
    </Card>
  );
}
