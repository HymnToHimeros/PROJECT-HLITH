import { useId, useState, type ReactNode } from 'react';
import type { GameContract } from '../../core/contract';
import { known, unknown } from '../../core/contract/known';
import { backend } from '../../core/data/backend';
import { Button, EmptyState, ExampleTag, GameTag, HowTo, StatTile, UnverifiedTag, useNow } from '../../core/ui';
import { Switch } from '../account/parts';
import {
  addCodes,
  forgetOnServer,
  latestRedemptions,
  lastCheckinLine,
  maskId,
  nextLabel,
  readCodes,
  readRedeemLogin,
  REDEEM_WORD,
  runNow,
  saveOnServer,
  setRedeemLogin,
  updateAccount,
  when,
  type LinkedAccount,
  type ServerState,
} from './accounts';
import c from './connections.module.css';
import { askHoyolab, forgetDeviceAccount, fullIn, hoyolabLink, saveDeviceAccount, type HoyoAccount, type HoyoAnswer, type HoyoEndgame, type HoyoLogin, type Part } from './hoyolab';
import { HoyolabSteps, PasteLogin } from './HoyolabLogin';
import { useAccounts } from './useAccounts';
import { useExamplesShown } from '../../core/data/prefs';

export { linkBlocker } from './useAccounts';

const SOURCE = 'community docs';
const CODE_LIST = 'hoyo-codes.seria.moe';

/**
 * Account → Connected accounts (R47 + saved accounts): ONE list of HoYoLAB logins
 * ("Main", "Alt"…), each covering one or more games and UIDs, instead of one block
 * per game. Each account reads live stamina, check-in and endgame per game; saved on
 * HLITH's server it can also check in and redeem codes by itself every day.
 */
export function LinkAccounts({ games, allGames }: { games: GameContract[]; /** Every registered game, switched on or not. Missing = games. */ allGames?: GameContract[] }) {
  const linkable = games.filter((g) => hoyolabLink(g));
  // Loaded for every game, so an account can say which switched-off games it still covers.
  const allLinkable = (allGames ?? games).filter((g) => hoyolabLink(g));
  const { accounts, server, blocker, loadError, refresh } = useAccounts(allLinkable);
  const [adding, setAdding] = useState(false);

  if (linkable.length === 0) {
    return <EmptyState title="No HoYoLAB link for your games" body="None of the games you track has a HoYoLAB link, so live stamina, check-in and import aren’t available." />;
  }
  const showAdd = adding || accounts.length === 0;

  return (
    <div className={c.stack}>
      <HowTo
        title="How connected accounts work"
        steps={[
          <>Add a HoYoLAB account: paste its login values (the guide in the form shows where to find them). Give it a name like “Main” or “Alt”.</>,
          <>HLITH looks up which games and UIDs that login has. One login can cover several games; each game keeps its own data.</>,
          <>Choose where the login is kept: used once, remembered on this device, or saved on HLITH’s server. Only a login saved on the server can check in and redeem codes by itself.</>,
          <>In each account, press “Check now” next to a game for live stamina, daily activity, check-in and endgame records.</>,
          <>Turn on “Automatic daily check-in” and, with the extra code login, “Redeem codes automatically”. Results show under each game.</>,
        ]}
      >
        <p className={c.body}>
          <strong>Saved on HLITH’s server</strong> means: the login values are stored encrypted (Supabase Vault). Nobody can read them back in a browser, not even you; only HLITH’s server uses them, to talk to HoYoLAB for you. They are never written to logs.
        </p>
        <p className={c.body}>
          <strong>To stop it:</strong> switch “Automatic daily check-in” or “Redeem codes automatically” off, or press “Forget” on the account. Forget overwrites the saved login with random text at once, so it can’t be used again. Pressing Log out on hoyolab.com also ends the login for everyone, HLITH included.
        </p>
      </HowTo>
      <div className={c.row}>
        <UnverifiedTag source={SOURCE} />
        <span className={c.muted}>HoYoLAB has no official API. This follows what community tools (genshin.py) document and hasn’t been tested with a live account yet, so treat its numbers as unconfirmed.</span>
      </div>
      {blocker && <span className={c.muted}>{blocker}</span>}
      {loadError && (
        <span className={c.error} role="alert">
          {loadError}
        </span>
      )}

      <section className={c.tight} aria-label="Your HoYoLAB accounts">
        <div className={c.cardHead}>
          <span className={c.label}>Your HoYoLAB accounts · {accounts.length}</span>
          {!showAdd && <Button onClick={() => setAdding(true)}>Add a HoYoLAB account</Button>}
        </div>
        {accounts.length > 0 ? accounts.map((a) => <AccountCard key={a.id} account={a} games={linkable} offGames={allLinkable.filter((g) => !linkable.some((l) => l.id === g.id))} server={server} blocker={blocker} refresh={refresh} />) : <ExampleAccounts games={linkable} />}
      </section>

      {showAdd && (
        <AddAccount
          games={linkable}
          used={accounts.map((a) => a.label)}
          blocker={blocker}
          canCancel={accounts.length > 0}
          onDone={() => {
            setAdding(false);
            refresh();
          }}
          onCancel={() => setAdding(false)}
        />
      )}

      <AutoPanel games={linkable} accounts={accounts} server={server} blocker={blocker} refresh={refresh} />
      <OnItsOwn />
    </div>
  );
}

// ── One account ──────────────────────────────────────────────────

function AccountCard({
  account,
  games,
  offGames = [],
  server,
  blocker,
  refresh,
}: {
  account: LinkedAccount;
  games: GameContract[];
  /** Games this login can cover that are switched off in your games (their rows are hidden here). */
  offGames?: GameContract[];
  server: ServerState | null;
  blocker: string | null;
  refresh: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [mode, setMode] = useState<'view' | 'rename' | 'replace' | 'forget'>('view');
  const [label, setLabel] = useState(account.label);
  const now = useNow(60_000);
  const onServer = account.where === 'server';
  const covered = account.games.flatMap((g) => {
    const game = games.find((x) => x.id === g.gameId);
    return game ? [{ ...g, game }] : [];
  });
  const hiddenGames = offGames.filter((g) => account.games.some((x) => x.gameId === g.id));

  const done = (text: string | null, okText: string) => {
    setBusy(false);
    setMsg(text ? { ok: false, text } : { ok: true, text: okText });
    if (!text) {
      setMode('view');
      refresh();
    }
  };

  const rename = async () => {
    const next = label.trim().slice(0, 40) || 'Main';
    if (onServer) {
      if (!backend) return;
      setBusy(true);
      done(await updateAccount(backend, account.id, { label: next }), 'Renamed.');
    } else if (account.login) {
      saveDeviceAccount({ label: next, login: account.login, games: [] });
      done(null, 'Renamed.');
    }
  };

  const replace = async (login: HoyoLogin) => {
    if (onServer) {
      if (!backend) return;
      setBusy(true);
      const r = await saveOnServer(backend, { label: account.label, login, gameBiz: bizOf(games), linkId: account.id });
      done(r.ok ? null : r.text, 'New login saved. HLITH checked it with HoYoLAB first.');
    } else {
      if (account.login && account.login.ltuid_v2 !== login.ltuid_v2) forgetDeviceAccount(account.id);
      saveDeviceAccount({ label: account.label, login, games: account.games });
      done(null, 'New login remembered on this device.');
    }
  };

  const forget = async () => {
    if (onServer) {
      if (!backend) return;
      setBusy(true);
      done(await forgetOnServer(backend, account.id), 'Forgotten.');
    } else {
      forgetDeviceAccount(account.id);
      done(null, 'Forgotten.');
    }
  };

  const moveToServer = async () => {
    if (!backend || !account.login) return;
    setBusy(true);
    const r = await saveOnServer(backend, { label: account.label, login: account.login, gameBiz: bizOf(games) });
    if (r.ok) forgetDeviceAccount(account.id);
    done(r.ok ? null : r.text, 'Saved on HLITH’s server and removed from this device.');
  };

  return (
    <section className={c.card} aria-label={`HoYoLAB account ${account.label}`}>
      <div className={c.cardHead}>
        <div className={c.tight}>
          <span className={c.label}>{onServer ? 'Saved on HLITH’s server · encrypted' : account.id === 'once' ? 'Used once · not saved' : 'Remembered on this device only'}</span>
          <h3 className={c.cardTitle}>{account.label}</h3>
          <span className={c.muted}>HoYoLAB ID {maskId(account.hoyolabId)}</span>
        </div>
        {account.id !== 'once' && (
          <div className={c.row}>
            <Button variant="quiet" onClick={() => setMode(mode === 'rename' ? 'view' : 'rename')}>
              Rename
            </Button>
            <Button variant="quiet" onClick={() => setMode(mode === 'replace' ? 'view' : 'replace')}>
              Replace login
            </Button>
            <Button variant="quiet" onClick={() => setMode(mode === 'forget' ? 'view' : 'forget')}>
              Forget
            </Button>
          </div>
        )}
      </div>

      {mode === 'rename' && (
        <form
          className={c.row}
          onSubmit={(e) => {
            e.preventDefault();
            void rename();
          }}
        >
          <input className={c.input} style={{ maxWidth: 240 }} value={label} maxLength={40} onChange={(e) => setLabel(e.target.value)} aria-label="Account name" />
          <Button type="submit" variant="primary" disabled={busy || (onServer && blocker !== null)}>
            Save name
          </Button>
        </form>
      )}
      {mode === 'replace' && (
        <div className={c.tight}>
          <span className={c.muted}>Paste fresh values for this account (after the old login expired or you logged out). {onServer ? 'The old saved login is overwritten.' : ''}</span>
          <HoyolabSteps />
          <PasteLogin submitLabel="Save the new login" busy={busy} disabledReason={blocker} onSubmit={(l) => void replace(l)} />
        </div>
      )}
      {mode === 'forget' && (
        <div className={c.notBuilt}>
          <span>
            {onServer
              ? 'Forget this account? The saved login is overwritten with random text right away and automatic check-in and codes stop. Your games’ data and past results stay. Your HoYoLAB account itself isn’t touched.'
              : 'Forget this account? The login is deleted from this browser. Your games’ data stays. Your HoYoLAB account itself isn’t touched.'}
          </span>
          <div className={c.row}>
            <Button variant="primary" disabled={busy || (onServer && blocker !== null)} onClick={() => void forget()}>
              Forget {account.label}
            </Button>
            <Button variant="quiet" onClick={() => setMode('view')}>
              Keep it
            </Button>
          </div>
        </div>
      )}

      <ul className={c.list} aria-label={`Games on ${account.label}`}>
        {covered.length === 0 && <li className={c.listRow}>No data yet: HoYoLAB listed no game accounts for the games you track on this login.</li>}
        {covered.map((g) => (
          <li key={`${g.gameId}:${g.uid ?? ''}`} className={c.listRow}>
            <GameCheck account={account} game={g.game} uid={g.uid} who={[g.nickname, g.uid ? `UID ${g.uid}` : '', g.server].filter(Boolean).join(' · ')} blocker={blocker} line={onServer && server ? lastCheckinLine(server.checkins, account.id, hoyolabLink(g.game)?.config.gameBiz ?? '', now) : null} />
          </li>
        ))}
      </ul>
      {hiddenGames.length > 0 && (
        <span className={c.muted}>
          Also covers {hiddenGames.map((g) => g.name).join(' and ')}, switched off in your games, so {hiddenGames.length === 1 ? 'it isn’t' : 'they aren’t'} listed here.
          {onServer && account.autoCheckin ? ' Automatic daily check-in still runs for it on HLITH’s server (the switch below covers every game on this login).' : ''} Switch the game on
          again (the + next to the game buttons) to see it here.
        </span>
      )}

      {onServer ? (
        <AutoSwitches account={account} server={server} blocker={blocker} refresh={refresh} />
      ) : (
        account.id !== 'once' && (
          <div className={c.notBuilt}>
            <span>Automatic check-in and codes need this login saved on HLITH’s server, because the server does them while nobody has the site open.</span>
            <div className={c.row}>
              <Button disabled={busy || blocker !== null} onClick={() => void moveToServer()}>
                Save on HLITH’s server instead
              </Button>
            </div>
          </div>
        )
      )}

      {msg && (
        <span className={msg.ok ? c.message : c.error} role={msg.ok ? 'status' : 'alert'}>
          {msg.text}
        </span>
      )}
    </section>
  );
}

const bizOf = (games: GameContract[]) => games.flatMap((g) => hoyolabLink(g)?.config.gameBiz ?? []);

/** One game on an account: who it is, "Check now" / "Check in now", the last check-in line and the readings. */
function GameCheck({ account, game, uid, who, blocker, line }: { account: LinkedAccount; game: GameContract; uid: string | undefined; who: string; blocker: string | null; line: { text: string; ok: boolean } | null }) {
  const [answer, setAnswer] = useState<HoyoAnswer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [choose, setChoose] = useState<HoyoAccount[] | null>(null);
  const link = hoyolabLink(game);
  const want: Part[] = (['account', 'stamina', 'checkin', 'endgame'] as Part[]).filter((p) => p === 'account' || link?.supports.includes(p as 'stamina' | 'checkin' | 'endgame'));

  const run = async (claim: boolean, pick?: string) => {
    if (!backend) return;
    setBusy(true);
    setError(null);
    setChoose(null);
    const base = { uid: pick ?? uid, want, claim };
    const res = await askHoyolab(backend, game, account.where === 'server' ? { linkId: account.id, ...base } : { login: account.login as HoyoLogin, ...base });
    setBusy(false);
    if (!res.ok) {
      if (res.accounts?.length) setChoose(res.accounts);
      return setError(res.text);
    }
    setAnswer(res.answer);
  };

  return (
    <div className={c.tight} style={{ width: '100%' }}>
      <div className={c.cardHead}>
        <span className={c.listName}>
          <span className={c.row}>
            <GameTag label={game.short} vent={game.vent} /> {game.name}
          </span>
          <span className={c.listSub}>{who || 'UID found when you check'}</span>
        </span>
        <span className={c.row}>
          <Button disabled={busy || blocker !== null} onClick={() => void run(false)}>
            {busy ? 'Asking…' : 'Check now'}
          </Button>
          {link?.supports.includes('checkin') && (
            <Button variant="quiet" disabled={busy || blocker !== null} onClick={() => void run(true)}>
              Check in now
            </Button>
          )}
        </span>
      </div>
      {line && <span className={line.ok ? c.muted : c.error}>{line.text}</span>}
      {error && (
        <span className={c.error} role="alert">
          {error}
        </span>
      )}
      {choose && (
        <div className={c.row}>
          <span className={c.label}>Which UID?</span>
          {choose.map((a) => (
            <Button key={a.uid} onClick={() => void run(false, a.uid)}>
              {a.nickname || 'Account'} · UID {a.uid} · {a.server}
            </Button>
          ))}
        </div>
      )}
      {answer && <Readings game={game} answer={answer} />}
    </div>
  );
}

/** Automatic daily check-in and codes for a saved account. */
function AutoSwitches({ account, server, blocker, refresh }: { account: LinkedAccount; server: ServerState | null; blocker: string | null; refresh: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [addCodeLogin, setAddCodeLogin] = useState(false);
  const now = useNow(60_000);
  const off = busy || blocker !== null;

  const flip = async (change: { auto_checkin?: boolean; auto_redeem?: boolean }, okText: string) => {
    if (!backend) return;
    setBusy(true);
    const err = await updateAccount(backend, account.id, change);
    setBusy(false);
    setMsg(err ? { ok: false, text: err } : { ok: true, text: okText });
    refresh();
  };
  const clearCodeLogin = async () => {
    if (!backend) return;
    setBusy(true);
    const r = await setRedeemLogin(backend, account.id, null);
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: 'Code login removed (overwritten on the server). Automatic codes are off.' } : { ok: false, text: r.text });
    refresh();
  };
  const recent = server ? latestRedemptions(server.redemptions, account.id) : [];

  return (
    <div className={c.tight}>
      <Switch
        label="Automatic daily check-in"
        hint="Once a day HLITH claims the HoYoLAB check-in reward for every game on this account, even when you don’t open the site."
        checked={account.autoCheckin}
        disabled={off}
        onChange={(on) => void flip({ auto_checkin: on }, on ? 'Automatic check-in is on. The first one happens on the next daily run.' : 'Automatic check-in is off. HLITH won’t use this login for it any more.')}
      />
      {account.hasRedeemLogin ? (
        <>
          <Switch
            label="Redeem codes automatically"
            hint="Every day HLITH tries new gift codes for each UID on this account. Rewards arrive in your in-game mail; collect them in the game."
            checked={account.autoRedeem}
            disabled={off}
            onChange={(on) => void flip({ auto_redeem: on }, on ? 'Automatic codes are on.' : 'Automatic codes are off.')}
          />
          <div className={c.row}>
            <Button variant="quiet" disabled={off} onClick={() => setAddCodeLogin((v) => !v)}>
              Replace code login
            </Button>
            <Button variant="quiet" disabled={off} onClick={() => void clearCodeLogin()}>
              Remove code login
            </Button>
          </div>
        </>
      ) : (
        <div className={c.notBuilt}>
          <span>
            <strong>Redeem codes automatically</strong> needs one more login: redeeming goes through hoyoverse.com, which uses a different login from HoYoLAB.
          </span>
          {!addCodeLogin && (
            <div className={c.row}>
              <Button disabled={off} onClick={() => setAddCodeLogin(true)}>
                Add the code login
              </Button>
            </div>
          )}
        </div>
      )}
      {addCodeLogin && (
        <CodeLoginForm
          linkId={account.id}
          blocker={blocker}
          onDone={(text) => {
            setAddCodeLogin(false);
            setMsg({ ok: true, text });
            refresh();
          }}
        />
      )}
      {recent.length > 0 ? (
        <div className={c.tight}>
          <span className={c.label}>Codes on this account</span>
          <ul className={c.list}>
            {recent.map((r) => (
              <li key={`${r.game_uid}:${r.code}`} className={c.listRow}>
                <span className={c.listName}>
                  <span className={c.mono}>{r.code}</span>
                  <span className={c.listSub}>
                    UID {r.game_uid} · {when(r.ran_at, now)}
                    {r.status !== 'redeemed' && r.message ? ` · ${r.message}` : ''}
                  </span>
                </span>
                <span className={`${c.status} ${r.status === 'redeemed' ? c.status_new : r.status === 'error' || r.status === 'login' || r.status === 'captcha' ? c.status_unknown : ''}`}>{REDEEM_WORD[r.status] ?? r.status}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        account.autoRedeem && <span className={c.muted}>No data yet: no code has been tried on this account.</span>
      )}
      {msg && (
        <span className={msg.ok ? c.message : c.error} role={msg.ok ? 'status' : 'alert'}>
          {msg.text}
        </span>
      )}
    </div>
  );
}

/*
 * The code login. Sources: genshin.py requires cookie_token / cookie_token_v2 for
 * redeem_code (client/manager/managers.py requires_cookie_token) and its auth guide
 * says to take them from the HoYoverse gift page (https://seria.is-a.dev/genshin.py/authentication).
 * The _v2 names (account_id_v2, account_mid_v2, cookie_token_v2) are what hoyoverse.com
 * sets today. Not tested with a live account yet.
 */
function CodeLoginForm({ linkId, blocker, onDone }: { linkId: string; blocker: string | null; onDone: (text: string) => void }) {
  const id = useId();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const save = async () => {
    const read = readRedeemLogin(text);
    if (!read.ok) return setProblem(`Still missing: ${read.missing.join(', ')}.`);
    if (!backend) return;
    setText('');
    setBusy(true);
    const r = await setRedeemLogin(backend, linkId, read.login);
    setBusy(false);
    if (!r.ok) return setProblem(r.text);
    setProblem(null);
    onDone('Code login saved (encrypted). Turn on “Redeem codes automatically” when you’re ready.');
  };
  return (
    <div className={c.tight}>
      <HowTo
        title="How to get the code login"
        open
        steps={[
          <>
            On a PC, open <span className={c.mono}>hsr.hoyoverse.com/gift</span> (or <span className={c.mono}>zenless.hoyoverse.com/redemption</span>) and log in with the same account.
          </>,
          <>
            Press <span className={c.mono}>F12</span> → <strong>Application</strong> (Firefox: <strong>Storage</strong>) → <strong>Cookies</strong> → the hoyoverse.com address.
          </>,
          <>
            Copy the values of <span className={c.mono}>account_id_v2</span> (a number), <span className={c.mono}>account_mid_v2</span> (ends in _hy) and <span className={c.mono}>cookie_token_v2</span> (starts with v2_). Paste all three below, in any order.
          </>,
        ]}
      >
        <p className={c.body}>
          <strong>Why another login?</strong> Codes are redeemed on hoyoverse.com, not HoYoLAB, and that site checks its own login (cookie_token_v2). The HoYoLAB values can’t redeem codes. Like the first login, it’s stored encrypted, only HLITH’s server can use it, and “Remove code login” or “Forget” overwrites it.
        </p>
      </HowTo>
      <label className={c.field} htmlFor={`${id}-code-login`}>
        Paste account_id_v2, account_mid_v2 and cookie_token_v2
      </label>
      <textarea id={`${id}-code-login`} className={c.textarea} rows={3} value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" spellCheck={false} disabled={blocker !== null} />
      <div className={c.row}>
        <Button variant="primary" disabled={busy || blocker !== null || !text.trim()} onClick={() => void save()}>
          {busy ? 'Saving…' : 'Save the code login'}
        </Button>
      </div>
      {problem && (
        <span className={c.error} role="alert">
          {problem}
        </span>
      )}
    </div>
  );
}

// ── Adding an account ────────────────────────────────────────────

type Keep = 'server' | 'device' | 'once';

function AddAccount({ games, used, blocker, canCancel, onDone, onCancel }: { games: GameContract[]; used: string[]; blocker: string | null; canCancel: boolean; onDone: () => void; onCancel: () => void }) {
  const id = useId();
  const [label, setLabel] = useState(() => nextLabel(used));
  const [keep, setKeep] = useState<Keep>('device');
  const [pick, setPick] = useState<string[]>(() => games.map((g) => g.id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [once, setOnce] = useState<LinkedAccount | null>(null);
  const chosen = games.filter((g) => pick.includes(g.id));

  const add = async (login: HoyoLogin) => {
    if (!backend || chosen.length === 0) return;
    setBusy(true);
    setError(null);
    if (keep === 'server') {
      const r = await saveOnServer(backend, { label, login, gameBiz: bizOf(chosen) });
      setBusy(false);
      if (!r.ok) return setError(r.text);
      return onDone();
    }
    // Device or once: ask HoYoLAB which UIDs this login has, game by game.
    const found: LinkedAccount['games'] = [];
    const problems: string[] = [];
    for (const game of chosen) {
      const r = await askHoyolab(backend, game, { login, want: ['account'] });
      if (r.ok) found.push({ gameId: game.id, uid: r.answer.account.uid, nickname: r.answer.account.nickname, server: r.answer.account.server });
      else if (r.accounts?.length) for (const a of r.accounts) found.push({ gameId: game.id, uid: a.uid, nickname: a.nickname, server: a.server });
      else problems.push(`${game.short}: ${r.text}`);
    }
    setBusy(false);
    if (found.length === 0) return setError(problems.join(' ') || 'HoYoLAB found no game accounts on this login.');
    if (keep === 'device') {
      saveDeviceAccount({ label, login, games: found.map((g) => ({ gameId: g.gameId, ...(g.uid ? { uid: g.uid } : {}) })) });
      return onDone();
    }
    setOnce({ id: 'once', label, where: 'device', hoyolabId: login.ltuid_v2, games: found, autoCheckin: false, autoRedeem: false, hasRedeemLogin: false, login });
  };

  return (
    <section className={c.card} aria-label="Add a HoYoLAB account">
      <div className={c.cardHead}>
        <h3 className={c.cardTitle}>Add a HoYoLAB account</h3>
        {canCancel && (
          <Button variant="quiet" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
      <HoyolabSteps />
      <label className={c.field} htmlFor={`${id}-label`}>
        Name for this account
      </label>
      <input id={`${id}-label`} className={c.input} value={label} maxLength={40} onChange={(e) => setLabel(e.target.value)} disabled={blocker !== null} />
      <fieldset className={c.tight} style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className={c.field}>Games to look for on this login</legend>
        <div className={c.row}>
          {games.map((g) => (
            <label key={g.id} className={c.toggle}>
              <input type="checkbox" checked={pick.includes(g.id)} disabled={blocker !== null} onChange={(e) => setPick((p) => (e.target.checked ? [...p, g.id] : p.filter((x) => x !== g.id)))} />
              <span>{g.name}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className={c.tight} style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className={c.field}>Where to keep the login</legend>
        {(
          [
            ['device', 'Remember on this device', 'Kept in this browser only: never synced, never in a backup. Anyone using this browser could use it.'],
            ['server', 'Save on HLITH’s server (encrypted)', 'Needed for automatic check-in and codes. Stored encrypted; no browser can read it back. Forget overwrites it.'],
            ['once', 'Use once', 'Just look now. Nothing is kept after you close this page.'],
          ] as [Keep, string, string][]
        ).map(([k, title, note]) => (
          <label key={k} className={c.toggle}>
            <input type="radio" name={`${id}-keep`} checked={keep === k} onChange={() => setKeep(k)} disabled={blocker !== null} />
            <span>
              {title}
              <span className={c.toggleNote}>{note}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <PasteLogin submitLabel={keep === 'once' ? 'Look it up' : `Add ${label.trim() || 'account'}`} busy={busy} disabledReason={blocker ?? (chosen.length === 0 ? 'Pick at least one game.' : null)} onSubmit={(l) => void add(l)} />
      {error && (
        <span className={c.error} role="alert">
          {error}
        </span>
      )}
      {once && <AccountCard account={once} games={games} server={null} blocker={blocker} refresh={() => undefined} />}
    </section>
  );
}

// ── Automatic jobs, codes and what needs you ─────────────────────

function AutoPanel({ games, accounts, server, blocker, refresh }: { games: GameContract[]; accounts: LinkedAccount[]; server: ServerState | null; blocker: string | null; refresh: () => void }) {
  const id = useId();
  const [game, setGame] = useState(games[0]?.id ?? '');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const saved = accounts.filter((a) => a.where === 'server');
  const withCodes = saved.filter((a) => a.hasRedeemLogin);
  const biz = (gid: string) => {
    const g = games.find((x) => x.id === gid);
    return g ? (hoyolabLink(g)?.config.gameBiz ?? '') : '';
  };
  const pasted = readCodes(text);

  const add = async () => {
    if (!backend || pasted.length === 0) return;
    setBusy(true);
    const r = await addCodes(backend, biz(game), text);
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.text });
    setText('');
    setMsg({ ok: true, text: `Added ${r.data.codes.join(', ')}. HLITH tries them on the next run for every saved account with the code login, or press “Run now”.` });
  };
  const run = async () => {
    if (!backend) return;
    setBusy(true);
    const r = await runNow(backend);
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.text });
    setMsg({ ok: true, text: `Done: ${r.data.checkins} check-in${r.data.checkins === 1 ? '' : 's'} and ${r.data.redemptions} code${r.data.redemptions === 1 ? '' : 's'} tried.${r.data.stoppedEarly ? ' The rest waits for the next run (time limit).' : ''} Results are under each account.` });
    refresh();
  };

  return (
    <section className={c.card} aria-label="Automatic check-in and codes">
      <span className={c.label}>Automatic check-in and codes</span>
      <HowTo
        title="How the automatic jobs work"
        steps={[
          <>Save an account on HLITH’s server (above), then switch on “Automatic daily check-in”.</>,
          <>Once a day, HLITH’s server claims the HoYoLAB check-in for every game on each switched-on account, without you opening the site.</>,
          <>For codes, add the code login on the account and switch on “Redeem codes automatically”. HLITH tries each new code once per UID, about 6 seconds apart (HoYoverse asks for a pause).</>,
          <>Each result shows under its game or account: when it ran, and what HoYoLAB answered (the reward, “already used”, “expired”, or the error).</>,
          <>Codes give their rewards through in-game mail: open the game to collect them.</>,
        ]}
      >
        <p className={c.body}>
          <strong>Where codes come from:</strong> the public list at <span className={c.mono}>{CODE_LIST}</span> (open source: github.com/seriaati/hoyo-codes), which gathers codes from public code pages and keeps only ones it could redeem on its own test account. Plus any codes you paste below. A code HoYoverse refuses is recorded and not tried again.
        </p>
        <p className={c.body}>
          <strong>To stop:</strong> switch the account’s switches off, or press Forget. Nothing runs for an account with both switches off.
        </p>
      </HowTo>
      <span className={c.muted}>
        {server
          ? `Codes HLITH knows about right now: ${games.map((g) => `${g.short} ${server.publicCodes[biz(g.id)] ?? 0}`).join(' · ')}.`
          : 'No data yet: the code list is read on HLITH’s server once you’re signed in.'}
        {' '}
        {saved.length === 0 ? 'No account is saved on the server yet.' : `${saved.filter((a) => a.autoCheckin).length} of ${saved.length} saved account${saved.length === 1 ? '' : 's'} check in automatically; ${withCodes.filter((a) => a.autoRedeem).length} redeem codes.`}
      </span>
      <div className={c.tight}>
        <label className={c.field} htmlFor={`${id}-codes`}>
          Paste codes to redeem on all your saved accounts
        </label>
        <div className={c.row}>
          <select className={c.input} style={{ maxWidth: 200 }} value={game} onChange={(e) => setGame(e.target.value)} aria-label="Which game the codes are for" disabled={blocker !== null}>
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
        <textarea id={`${id}-codes`} className={c.textarea} rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="STARRAILGIFT, …" disabled={blocker !== null} />
        <div className={c.row}>
          <Button disabled={busy || blocker !== null || pasted.length === 0} onClick={() => void add()}>
            Add {pasted.length || ''} code{pasted.length === 1 ? '' : 's'}
          </Button>
          <Button variant="quiet" disabled={busy || blocker !== null || saved.length === 0} onClick={() => void run()}>
            {busy ? 'Working…' : 'Run now'}
          </Button>
          <span className={c.muted}>Run now does today’s check-in and tries waiting codes for your saved accounts right away.</span>
        </div>
      </div>
      {msg && (
        <span className={msg.ok ? c.message : c.error} role={msg.ok ? 'status' : 'alert'}>
          {msg.text}
        </span>
      )}
    </section>
  );
}

/** What HLITH does by itself, and what honestly needs the player. Research notes in docs/PROGRESS.md. */
function OnItsOwn() {
  return (
    <section className={c.card} aria-label="What HLITH can do on its own">
      <span className={c.label}>What HLITH can do on its own</span>
      <ul className={c.list}>
        <li className={c.listRow}>
          <span className={c.listName}>
            Daily check-in
            <span className={c.listSub}>Every game on a saved account, once a day, when switched on.</span>
          </span>
          <span className={`${c.status} ${c.status_new}`}>automatic</span>
        </li>
        <li className={c.listRow}>
          <span className={c.listName}>
            Gift codes
            <span className={c.listSub}>With the extra code login. The reward lands in in-game mail; collecting it needs you.</span>
          </span>
          <span className={`${c.status} ${c.status_new}`}>automatic</span>
        </li>
      </ul>
      <span className={c.label}>Needs you</span>
      <ul className={c.list}>
        <li className={c.listRow}>
          <span className={c.listName}>
            Web events
            <span className={c.listSub}>Web events need you to open them yourself — HoYoLAB has no way for tools to do them. They’re browser mini-games with no documented calls.</span>
          </span>
          <span className={c.status}>needs you</span>
        </li>
        <li className={c.listRow}>
          <span className={c.listName}>
            Traveling Mimo
            <span className={c.listSub}>Its tasks mean doing things yourself, and spending its points is your choice, so HLITH leaves it to you.</span>
          </span>
          <span className={c.status}>needs you</span>
        </li>
        <li className={c.listRow}>
          <span className={c.listName}>
            HoYoLAB community check-in
            <span className={c.listSub}>HoYoLAB retired it; there is nothing left to claim.</span>
          </span>
          <span className={c.status}>gone</span>
        </li>
        <li className={c.listRow}>
          <span className={c.listName}>
            Captcha checks
            <span className={c.listSub}>When HoYoLAB asks for a captcha, HLITH says so and stops; solve it on hoyolab.com.</span>
          </span>
          <span className={c.status}>needs you</span>
        </li>
      </ul>
    </section>
  );
}

// ── Readings ─────────────────────────────────────────────────────

function Readings({ game, answer }: { game: GameContract; answer: HoyoAnswer }) {
  const p = answer.problems;
  const pool = game.stamina[0];
  return (
    <div className={c.tight}>
      <div className={c.cardHead}>
        <span className={c.label}>From HoYoLAB · read {new Date(answer.readAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        <span className={c.muted}>
          {answer.account.nickname} · UID {answer.account.uid} · {answer.account.server}
          {answer.account.level !== null && ` · level ${answer.account.level}`}
        </span>
      </div>
      <div className={c.grid}>
        <Tile problem={p.stamina?.text}>
          <StatTile
            label={pool?.name ?? 'Stamina'}
            value={answer.stamina ? known(`${answer.stamina.current}/${answer.stamina.max}`, 'hoyolab', answer.readAt) : unknown<string>('connect-account')}
            {...(answer.stamina ? { progress: answer.stamina.current / answer.stamina.max, caption: fullIn(answer.stamina.fullInSeconds) } : {})}
          />
        </Tile>
        <Tile problem={p.stamina?.text}>
          <StatTile label="Daily activity" value={answer.dailies ? known(`${answer.dailies.current}/${answer.dailies.max}`, 'hoyolab', answer.readAt) : unknown<string>('connect-account')} {...(answer.dailies ? { progress: answer.dailies.current / Math.max(1, answer.dailies.max) } : {})} />
        </Tile>
        <Tile problem={p.checkin?.text}>
          <StatTile
            label="Daily check-in"
            value={answer.checkin ? known(answer.checkin.checkedInToday ? 'Done' : 'Not yet', 'hoyolab', answer.readAt) : unknown<string>('connect-account')}
            {...(answer.checkin
              ? { caption: `${answer.checkin.claimedNow ? `Claimed just now${answer.checkin.reward ? `: ${answer.checkin.reward}` : ''}. ` : ''}${answer.checkin.daysThisMonth !== null ? `${answer.checkin.daysThisMonth} days this month` : ''}` }
              : {})}
          />
        </Tile>
      </div>
      <Endgame list={answer.endgame} problem={p.endgame?.text} />
    </div>
  );
}

function Tile({ problem, children }: { problem: string | undefined; children: ReactNode }) {
  return (
    <div className={c.tight}>
      {children}
      {problem && <span className={c.error}>{problem}</span>}
    </div>
  );
}

function Endgame({ list, problem }: { list: HoyoEndgame[] | undefined; problem: string | undefined }) {
  return (
    <div className={c.tight}>
      <span className={c.label}>Endgame record</span>
      {problem && <span className={c.error}>{problem}</span>}
      {!problem && (!list || list.length === 0) && <span className={c.muted}>No data yet: HoYoLAB sent no endgame record.</span>}
      {list && list.length > 0 && (
        <ul className={c.list}>
          {list.map((e) => (
            <li key={`${e.mode}-${e.season}`} className={c.listRow}>
              <span className={c.listName}>
                {e.label}
                <span className={c.listSub}>{e.season === 'current' ? 'This season' : 'Last season'}</span>
              </span>
              <span className={c.num}>{e.hasData ? figures(e) : 'not played'}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const figures = (e: Pick<HoyoEndgame, 'stars' | 'score' | 'maxScore' | 'floor' | 'battles'>) =>
  [e.stars !== undefined ? `${e.stars} ★` : '', e.score !== undefined ? `${e.score}${e.maxScore !== undefined ? `/${e.maxScore}` : ''} pts` : '', e.floor ? e.floor : ''].filter(Boolean).join(' · ') || 'played';

/** Before any account is linked: what the list looks like, clearly marked EXAMPLE. */
function ExampleAccounts({ games }: { games: GameContract[] }) {
  const shown = useExamplesShown();
  const first = games[0];
  // The example reward uses the first game's own premium currency, never another game's.
  const reward = first?.currencies.find((cur) => cur.perPull)?.name ?? first?.currencies[0]?.name;
  const examples = [
    { label: 'Main', where: 'Saved on HLITH’s server · encrypted', games: games.slice(0, 2), line: `Last automatic check-in: today 05:02${reward ? ` · got 20 × ${reward}` : ''}` },
    { label: 'Alt', where: 'Remembered on this device only', games: games.slice(0, 1), line: null },
  ];
  if (!shown) return null; // Account → Example data: off
  return (
    <div className={`${c.card} ${c.example}`} aria-label="Example accounts">
      <div className={c.row}>
        <ExampleTag />
        <span className={c.muted}>What your list looks like after adding accounts. Example names and numbers, not yours.</span>
      </div>
      {examples.map((e, i) => (
        <div key={e.label} className={c.tight}>
          <span className={c.label}>{e.where}</span>
          <h3 className={c.cardTitle}>{e.label}</h3>
          <ul className={c.list}>
            {e.games.map((g, j) => (
              <li key={g.id} className={c.listRow}>
                <span className={c.listName}>
                  <span className={c.row}>
                    <GameTag label={g.short} vent={g.vent} /> {g.name}
                  </span>
                  <span className={c.listSub}>
                    Player · UID {i === 0 ? 700000000 + j : 800000000 + j} · Europe
                  </span>
                  {e.line && j === 0 && <span className={c.listSub}>{e.line}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {first && <ExampleReadings game={first} />}
    </div>
  );
}

/** What the readings will look like, clearly marked EXAMPLE until the player connects. */
function ExampleReadings({ game }: { game: GameContract }) {
  const pool = game.stamina[0];
  const max = pool?.max ?? 240;
  const now = Math.round(max * 0.75);
  const minutes = pool ? (max - now) * pool.minutesPerPoint : 0;
  const modes = game.terms.endgame.slice(0, 3);
  return (
    <div className={c.tight} aria-label="Example readings">
      <span className={c.label}>Example “Check now” for {game.short}</span>
      <div className={c.grid}>
        <StatTile label={pool?.name ?? 'Stamina'} value={known(`${now}/${max}`, 'user')} progress={now / max} caption={fullIn(minutes * 60)} />
        <StatTile label="Daily activity" value={known('300/500', 'user')} progress={0.6} />
        <StatTile label="Daily check-in" value={known('Not yet', 'user')} caption="8 days this month" />
      </div>
      {modes.length > 0 && (
        <ul className={c.list} aria-label="Example endgame record">
          {modes.map((m, i) => (
            <li key={m} className={c.listRow}>
              <span className={c.listName}>
                {m}
                <span className={c.listSub}>This season</span>
              </span>
              <span className={c.num}>{[`${30 - i * 6} ★`, `${i === 0 ? 'Floor 12' : 'played'}`].join(' · ')}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
