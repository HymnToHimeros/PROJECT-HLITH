import { useRef, useState, type ReactNode } from 'react';
import type { GameContract } from '../../core/contract';
import { known, unknown } from '../../core/contract/known';
import { useSession } from '../../core/auth/session';
import { backend } from '../../core/data/backend';
import { Button, EmptyState, ExampleTag, StatTile, UnverifiedTag } from '../../core/ui';
import c from './connections.module.css';
import { askHoyolab, forgetLogin, fullIn, hoyolabLink, otherSaved, rememberLogin, savedLogin, type HoyoAccount, type HoyoAnswer, type HoyoEndgame, type HoyoLogin, type Part } from './hoyolab';
import { HoyolabLoginForm, HoyolabSteps, type LoginChoice } from './HoyolabLogin';

const SOURCE = 'community docs';

/** Why the link can't be used right now, or null when it can. */
export function linkBlocker(signedIn: boolean): string | null {
  if (!backend) return 'This copy of HLITH runs on this device only, without HLITH’s server, so it can’t reach HoYoLAB. The form is shown so you can see how it works.';
  if (!signedIn) return 'Sign in to HLITH first: the HoYoLAB link goes through HLITH’s server, which only answers signed-in players.';
  return null;
}

/**
 * Account → HoYoLAB link for one game (R47). Reads live stamina, daily activity,
 * check-in, and endgame records; can claim today's check-in. Character import
 * lives in Roster (RosterImport) and uses the same login.
 */
export function LinkAccount({ game }: { game: GameContract }) {
  const signedIn = Boolean(useSession(backend));
  const [answer, setAnswer] = useState<HoyoAnswer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [choose, setChoose] = useState<HoyoAccount[] | null>(null);
  const [, setVersion] = useState(0); // re-render after remember / forget
  // Held only while the player picks between several accounts, then dropped.
  const pending = useRef<{ choice: LoginChoice; claim: boolean } | null>(null);
  const link = hoyolabLink(game);

  if (!link) {
    return (
      <section className={c.card} aria-label={`HoYoLAB link for ${game.name}`}>
        <EmptyState title="No HoYoLAB link for this game" body="This game’s record has no HoYoLAB link, so live stamina, check-in and import aren’t available for it." />
      </section>
    );
  }

  const blocker = linkBlocker(signedIn);
  const want: Part[] = (['account', 'stamina', 'checkin', 'endgame'] as Part[]).filter((p) => p === 'account' || link.supports.includes(p as 'stamina' | 'checkin' | 'endgame'));
  const saved = savedLogin(game.id);
  const others = otherSaved(game.id);

  const run = async (choice: LoginChoice, claim: boolean) => {
    if (!backend) return;
    setBusy(true);
    setError(null);
    setChoose(null);
    const res = await askHoyolab(backend, game, { login: choice.login, uid: choice.uid, want, claim });
    setBusy(false);
    if (!res.ok) {
      if (res.accounts?.length) {
        pending.current = { choice, claim };
        setChoose(res.accounts);
      }
      return setError(res.text);
    }
    pending.current = null;
    if (choice.remember) rememberLogin(game.id, choice.login, res.answer.account.uid);
    setVersion((v) => v + 1);
    setAnswer(res.answer);
  };

  const copyFrom = (other: string) => {
    const o = savedLogin(other);
    if (o) {
      rememberLogin(game.id, o.login as HoyoLogin);
      setVersion((v) => v + 1);
    }
  };

  return (
    <section className={c.card} aria-label={`HoYoLAB link for ${game.name}`}>
      <div className={c.cardHead}>
        <div className={c.tight}>
          <span className={c.label}>HoYoLAB link</span>
          <h3 className={c.cardTitle}>{game.name}</h3>
          <span className={c.muted}>{saved ? 'Login remembered on this device.' : 'Not remembered: each check asks for the login again (used once).'}</span>
        </div>
        <UnverifiedTag source={SOURCE} />
      </div>
      <span className={c.muted}>HoYoLAB has no official API. This link follows what community tools (genshin.py) document and hasn’t been tested with a live account yet, so treat its numbers as unconfirmed.</span>

      <HoyolabSteps game={game} />

      <HoyolabLoginForm
        game={game}
        submitLabel="Check now"
        busy={busy}
        disabledReason={blocker}
        onSubmit={(choice) => void run(choice, false)}
        extra={
          link.supports.includes('checkin') && saved ? (
            <Button disabled={busy || blocker !== null} onClick={() => void run({ login: saved.login, uid: saved.uid, remember: true, fromSaved: true }, true)}>
              Check in now
            </Button>
          ) : null
        }
      />

      {others.length > 0 && !saved && (
        <div className={c.row}>
          {others.map((o) => (
            <Button key={o} variant="quiet" onClick={() => copyFrom(o)}>
              Use the login remembered for {o.toUpperCase()}
            </Button>
          ))}
        </div>
      )}

      {saved && (
        <div className={c.row}>
          <Button
            variant="quiet"
            onClick={() => {
              forgetLogin(game.id);
              setVersion((v) => v + 1);
            }}
          >
            Forget the login on this device
          </Button>
          <span className={c.muted}>Deletes it from this browser. Your HoYoLAB account isn’t touched.</span>
        </div>
      )}

      {error && (
        <span className={c.error} role="alert">
          {error}
        </span>
      )}
      {choose && (
        <div className={c.tight}>
          <span className={c.label}>Which account?</span>
          <div className={c.row}>
            {choose.map((a) => (
              <Button
                key={a.uid}
                onClick={() => {
                  const p = pending.current;
                  if (p) void run({ ...p.choice, uid: a.uid }, p.claim);
                }}
              >
                {a.nickname || 'Account'} · UID {a.uid} · {a.server}
              </Button>
            ))}
            <Button
              variant="quiet"
              onClick={() => {
                pending.current = null;
                setChoose(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {answer ? <Readings game={game} answer={answer} /> : <ExampleReadings game={game} />}

      <ComingNext />
    </section>
  );
}

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
            {...(answer.checkin ? { caption: `${answer.checkin.claimedNow ? 'Claimed just now. ' : ''}${answer.checkin.daysThisMonth !== null ? `${answer.checkin.daysThisMonth} days this month` : ''}` } : {})}
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

/** What the readings will look like, clearly marked EXAMPLE until the player connects. */
function ExampleReadings({ game }: { game: GameContract }) {
  const pool = game.stamina[0];
  const max = pool?.max ?? 240;
  const now = Math.round(max * 0.75);
  const minutes = pool ? (max - now) * pool.minutesPerPoint : 0;
  const modes = game.terms.endgame.slice(0, 3);
  return (
    <div className={`${c.card} ${c.example}`} aria-label="Example readings">
      <div className={c.row}>
        <ExampleTag />
        <span className={c.muted}>What you’ll see after connecting. Example numbers, not yours.</span>
      </div>
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

/** V1 had these; each has its place here until it's built. */
function ComingNext() {
  return (
    <div className={c.notBuilt}>
      <span className={c.label}>Not built yet</span>
      <span>Automatic check-in once a day when you open HLITH (needs the login remembered on this device).</span>
      <span>Ticking Today’s daily tasks from HoYoLAB’s daily activity.</span>
      <span>Live stamina on Today, and the teams you used in endgame.</span>
    </div>
  );
}

/** Account panel section: one link card per game that has one. */
export function LinkAccounts({ games }: { games: GameContract[] }) {
  return (
    <div className={c.stack}>
      {games.map((g) => (
        <LinkAccount key={g.id} game={g} />
      ))}
    </div>
  );
}
