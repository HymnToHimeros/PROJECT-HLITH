import { useEffect, useState } from 'react';
import type { GameContract, GameId } from '../../core/contract';
import { DEFAULT_NOTIFY, updatePrefs, usePrefs, type NotifyPrefs } from '../../core/data/prefs';
import { Button, HowTo, Segmented } from '../../core/ui';
import { buildEveningMessage, type EveningMessage } from '../../../supabase/functions/_shared/evening.ts';
import { Card, Switch } from '../account/parts';
import a from '../account/account.module.css';
import { feedUrl, hasServer, newToken, readReminders, saveReminders, type ReminderRow } from './server';
import { buildSnapshot } from './snapshot';
import { formatDate, formatTime } from '../../core/time/reset';

interface Props {
  games: GameContract[];
  servers: Record<GameId, string>;
  signedIn: boolean;
  /** Open Game settings (to choose a server). */
  chooseServer: () => void;
}

type Permission = NotificationPermission | 'unsupported';
const permissionNow = (): Permission => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);

/**
 * ★ Evening message and calendar feed settings (R53, no design yet: built from
 * the shared tokens). Account → Notifications.
 */
export function FeedSettings({ games, servers, signedIn, chooseServer }: Props) {
  const prefs = usePrefs();
  const notify: NotifyPrefs = { ...DEFAULT_NOTIFY, ...prefs.notify, items: { ...DEFAULT_NOTIFY.items, ...prefs.notify?.items } };
  const setNotify = (change: Partial<NotifyPrefs>) => updatePrefs((p) => ({ ...p, notify: { ...notify, ...change } }));
  const setItem = (k: keyof NotifyPrefs['items'], on: boolean) => setNotify({ items: { ...notify.items, [k]: on } });
  const [permission, setPermission] = useState<Permission>(permissionNow);
  const [preview, setPreview] = useState<EveningMessage | null>(null);
  const [testNote, setTestNote] = useState('');
  const noServer = games.filter((g) => !g.servers.some((s) => s.id === servers[g.id]));

  const turnOn = async (on: boolean) => {
    setNotify({ enabled: on });
    if (on && permission === 'default') {
      const result = await Notification.requestPermission();
      setPermission(result);
    }
  };

  const build = async () => {
    const snap = await buildSnapshot(games, servers, Date.now(), prefs.hiddenTasks);
    return buildEveningMessage(snap, { items: notify.items, eventDays: notify.eventDays }, Date.now());
  };
  const showPreview = async () => setPreview(await build());
  const sendTest = async () => {
    const msg = await build();
    setPreview(msg);
    if (permission === 'granted') {
      new Notification(`HLITH · ${msg.title}`, { body: msg.text, tag: 'hlith-evening' });
      setTestNote('Sent to this device. If nothing appeared, check that this browser may show notifications.');
    } else {
      setTestNote('Notifications aren’t allowed in this browser, so the message is shown here instead.');
    }
  };

  return (
    <div className={a.stack}>
      <Card title="Evening message">
        <p className={a.text}>One short message each evening with what is still open before the reset: resets, banners and events about to end, your wanted characters.</p>
        <p className={`${a.small} ${a.info}`}>
          <strong>Preview only.</strong> HLITH can’t send this message by itself yet: you see it when you press Preview or Send a test. Your choices below are
          kept for when sending works.
        </p>
        <Switch label="Evening message on this device (preview only)" checked={notify.enabled} onChange={(on) => void turnOn(on)} disabled={permission === 'unsupported'} />
        <span className={a.small} role="status">
          {permission === 'unsupported'
            ? 'This browser can’t show notifications.'
            : permission === 'denied'
              ? 'Notifications are blocked for HLITH. Allow them in your browser or phone settings, then come back.'
              : permission === 'granted'
                ? 'This browser may show HLITH notifications.'
                : 'Your browser will ask once whether HLITH may show notifications.'}
        </span>
        <label className={a.switchRow}>
          <span className={a.switchText}>
            Time
            <small>Your local time.</small>
          </span>
          <input className={a.input} type="time" value={notify.time} onChange={(e) => setNotify({ time: e.target.value || DEFAULT_NOTIFY.time })} aria-label="Evening message time" />
        </label>
        <span className={a.label}>WHAT IT MENTIONS</span>
        <Switch label="Resets" hint="Daily reset, and the weekly reset on its last day." checked={notify.items.resets} onChange={(on) => setItem('resets', on)} />
        <Switch label="Stamina full" hint="Needs a live reading from HoYoLAB: no data yet, so it stays quiet." checked={notify.items.stamina} onChange={(on) => setItem('stamina', on)} />
        <Switch label="Banners ending" hint="In their last two days." checked={notify.items.banners} onChange={(on) => setItem('banners', on)} />
        <Switch label="Wanted characters leaving" hint="Banners with a character on your wanted list, in their last three days." checked={notify.items.wanted} onChange={(on) => setItem('wanted', on)} />
        <Switch label="Events ending" hint="Events you haven’t marked done or skipped." checked={notify.items.events} onChange={(on) => setItem('events', on)} />
        {notify.items.events && (
          <Segmented
            label="How early events join the message"
            options={[
              { id: '1', label: 'Last evening' },
              { id: '2', label: 'Last two evenings' },
            ]}
            value={String(notify.eventDays) as '1' | '2'}
            onChange={(v) => setNotify({ eventDays: v === '1' ? 1 : 2 })}
          />
        )}
        {noServer.length > 0 && (
          <p className={a.small}>
            Choose your {noServer.map((g) => g.short).join(' and ')} server so resets can be timed.{' '}
            <Button variant="quiet" onClick={chooseServer}>
              Choose server
            </Button>
          </p>
        )}
        <div className={a.actions}>
          <Button onClick={() => void showPreview()}>Preview tonight’s message</Button>
          <Button variant="primary" onClick={() => void sendTest()} disabled={permission === 'unsupported'}>
            Send a test
          </Button>
        </div>
        {preview && (
          <>
            <pre className={a.preview} aria-label="Tonight’s message">
              {preview.title}
              {'\n'}
              {preview.text}
            </pre>
            {preview.noData.length > 0 && <p className={a.small}>No data yet for: {preview.noData.join(', ')}.</p>}
          </>
        )}
        {testNote && <p className={a.small}>{testNote}</p>}
        <p className={a.small}>
          Why preview only: sending it to your phone every evening, even with HLITH closed, needs push keys on HLITH’s server. The owner hasn’t set those up yet, so
          for now the message is built when you press Preview or Send a test.
        </p>
      </Card>

      <CalendarFeed games={games} servers={servers} signedIn={signedIn} />

      <HowTo
        steps={[
          'Switch on “Evening message on this device (preview only)” and allow notifications when your browser asks.',
          'Pick the time and what it should mention. Each switch only adds lines when there is something real to say.',
          'Press “Send a test” to see tonight’s message right now. HLITH can’t send it by itself yet.',
          ...(hasServer() && signedIn
            ? [
                'Calendar feed: press “Create my calendar link”, then “Add to my calendar”. Your resets, banners and events appear in your phone’s calendar.',
                'Resets repeat by themselves. After banners, events or your plans change, press “Update dates now” so the calendar gets the new dates.',
                'If you shared the link by mistake, press “New link”: the old one stops working.',
              ]
            : []),
        ]}
      />
    </div>
  );
}

function CalendarFeed({ games, servers, signedIn }: { games: GameContract[]; servers: Record<GameId, string>; signedIn: boolean }) {
  const prefs = usePrefs();
  const [row, setRow] = useState<ReminderRow | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const ready = hasServer() && signedIn;

  useEffect(() => {
    if (!ready) return;
    let alive = true;
    readReminders()
      .then((r) => alive && setRow(r))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : 'Could not read your calendar link.'));
    return () => {
      alive = false;
    };
  }, [ready]);

  const run = async (change: { feed_enabled?: boolean; feed_token?: string | null }) => {
    setBusy(true);
    setError('');
    try {
      const schedule = await buildSnapshot(games, servers, Date.now(), prefs.hiddenTasks);
      setRow(await saveReminders({ ...change, schedule, ...(prefs.notify ? { notify: prefs.notify } : {}) }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That didn’t work. Nothing was changed.');
    } finally {
      setBusy(false);
    }
  };

  if (!ready) {
    return (
      <Card title="Calendar feed">
        <p className={a.text}>Your resets, banners, events and plans in your phone’s or computer’s calendar.</p>
        <p className={a.small}>
          No data yet: the calendar link is served by HLITH’s server and needs sign-in. {hasServer() ? 'Sign in to create your link.' : 'This site runs in “this device only” mode, so there is no server to serve it yet.'}
        </p>
      </Card>
    );
  }
  const url = row?.feed_enabled && row.feed_token ? feedUrl(row.feed_token) : null;
  return (
    <Card title="Calendar feed">
      <p className={a.text}>Your resets, banners, events and plans in your phone’s or computer’s calendar.</p>
      <span className={a.status} role="status">
        <span className={`${a.dot} ${url ? a.dotOk : ''}`} aria-hidden="true" />
        {row === undefined ? 'Checking…' : url ? 'Your calendar link is on' : 'No calendar link yet'}
      </span>
      {url ? (
        <>
          <input className={`${a.input} ${a.mono}`} readOnly value={url} aria-label="Your calendar link" onFocus={(e) => e.target.select()} />
          <div className={a.actions}>
            <Button
              onClick={() =>
                void navigator.clipboard.writeText(url).then(
                  () => setCopied(true),
                  () => setError('Copy didn’t work here. Press and hold the link instead.'),
                )
              }
            >
              {copied ? 'Copied' : 'Copy link'}
            </Button>
            <a className={a.row} style={{ width: 'auto', minHeight: 44 }} href={url.replace(/^https?:/, 'webcal:')}>
              Add to my calendar
            </a>
            <Button disabled={busy} onClick={() => void run({})}>
              Update dates now
            </Button>
            <Button disabled={busy} onClick={() => window.confirm('Make a new link? The old one stops working and calendars using it must be added again.') && void run({ feed_enabled: true, feed_token: newToken() })}>
              New link
            </Button>
            <Button disabled={busy} onClick={() => window.confirm('Switch the calendar link off?') && void run({ feed_enabled: false })}>
              Switch off
            </Button>
          </div>
          <p className={a.small}>
            Resets repeat by themselves. Banner, event and plan dates are a copy saved {savedWhen(row?.updated_at)}; after they change, press Update dates now.
          </p>
          <p className={a.small}>Anyone with the link can read your resets, dates and plan titles. Nothing else (no pulls, no bank log).</p>
        </>
      ) : (
        <div className={a.actions}>
          <Button variant="primary" disabled={busy || row === undefined} onClick={() => void run({ feed_enabled: true, feed_token: row?.feed_token ?? newToken() })}>
            Create my calendar link
          </Button>
        </div>
      )}
      {error && (
        <p className={`${a.small} ${a.warn}`} role="alert">
          {error}
        </p>
      )}
    </Card>
  );
}

/** "on 3 Oct, 21:04" from the reminder row's last save, or a plain fallback. */
function savedWhen(iso: string | undefined): string {
  const t = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(t)) return 'when you last pressed a button here';
  return `on ${formatDate(t)}, ${formatTime(t)}`;
}
