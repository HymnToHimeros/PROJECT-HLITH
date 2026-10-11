import { useCallback, useId, useMemo, useState, useSyncExternalStore } from 'react';
import { useSession } from '../../core/auth/session';
import { backend } from '../../core/data/backend';
import { Switch } from '../account/parts';
import { storeFor, useProfile } from '../account/useProfile';
import type { Character, GameContract } from '../../core/contract';
import { saveTeam, useGameData, type UserTeam } from '../../core/data/userData';
import { BottomSheet, Button, CharacterTile, HowTo } from '../../core/ui';
import c from '../account-links/connections.module.css';
import { useCharacters } from '../account-links/RosterImport';
import { decodeTeam, DECODE_TEXT, FRAGMENT_KEY, shareUrl, teamAsText, type SharedTeam } from './shareLink';
import { SharedBy, type CardLoader } from './SharedBy';

const nameFrom = (list: Character[] | null) => (id: string) => list?.find((ch) => ch.id === id)?.name ?? `Unknown (${id})`;

/**
 * "Share" on one of your teams (R54): a link with the team inside it, plus copy
 * as text, save as a picture, and the phone's share sheet (all three were in V1).
 */
export function ShareTeam({ game, team }: { game: GameContract; team: UserTeam }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <Button variant="quiet" onClick={() => setOpen(true)}>
        Share
      </Button>
      <BottomSheet open={open} side title={`Share · ${team.name}`} onClose={close}>
        {open && <ShareSheet game={game} team={team} onClose={close} />}
      </BottomSheet>
    </>
  );
}

function ShareSheet({ game, team, onClose }: { game: GameContract; team: UserTeam; onClose: () => void }) {
  const id = useId();
  const characters = useCharacters(game);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  // T52: your profile card can go with the link, if you allowed it in Profile → Customise → Who sees your card.
  const session = useSession(backend);
  const userId = session?.user.id;
  const store = useMemo(() => storeFor(userId), [userId]);
  const profile = useProfile(store);
  const cardAllowed = Boolean(userId) && store.mode === 'account' && profile.profile.privacy.card;
  const [withCard, setWithCard] = useState(true);
  const shared: SharedTeam = { game: game.id, name: team.name, members: team.members, ...(cardAllowed && withCard && userId ? { by: userId } : {}) };
  const url = shareUrl(window.location.origin, shared);
  const text = teamAsText(game.name, shared, nameFrom(characters), url);
  const canShare = typeof navigator !== 'undefined' && 'share' in navigator;

  const copy = async (what: string, done: string) => {
    try {
      await navigator.clipboard.writeText(what);
      setNote({ ok: true, text: done });
    } catch {
      setNote({ ok: false, text: 'Copying is blocked here. Select the link and copy it by hand.' });
    }
  };
  const picture = async () => {
    const blob = await teamPicture(game, shared, nameFrom(characters));
    if (!blob) return setNote({ ok: false, text: 'Couldn’t make the picture in this browser.' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${team.name.replace(/[^\w-]+/g, '-') || 'team'}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    setNote({ ok: true, text: 'Picture saved to your downloads.' });
  };
  const share = async () => {
    try {
      await navigator.share({ title: team.name, text, url });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) setNote({ ok: false, text: 'Sharing isn’t available here.' });
    }
  };

  return (
    <div className={c.stack}>
      <div className={c.sheetBar}>
        <span className={c.muted}>{team.members.length} in this team</span>
        <Button variant="quiet" onClick={onClose}>
          Close
        </Button>
      </div>
      <HowTo
        title="How sharing works"
        steps={[
          <>Copy the link and send it anywhere: a chat, Discord, a note.</>,
          <>Whoever opens it sees this team in HLITH, read-only, and can press “Save to my teams” to keep a copy.</>,
          <>Prefer something else? Copy the team as text, save it as a picture, or use your phone’s share menu.</>,
        ]}
      >
        <p className={c.body}>
          The team is written into the link itself (after the #). Nothing is stored on a server. The link holds only the team name and who’s in it, and, if you choose to show your profile card,
          your account id so HLITH can show it. Browsers don’t send the part after # to any server.
        </p>
      </HowTo>
      {userId && !profile.loading && (
        <div className={c.tight}>
          {cardAllowed ? (
            <Switch label="Show my profile card with it" hint="Whoever opens the link (signed in) sees your card next to the team." checked={withCard} onChange={setWithCard} />
          ) : (
            <span className={c.muted}>Your profile card stays private. To show it with teams you share, switch it on in Account → Profile → Customise profile → Who sees your card.</span>
          )}
        </div>
      )}
      <div className={c.tight}>
        <label className={c.field} htmlFor={`${id}-link`}>
          Share link
        </label>
        <input id={`${id}-link`} className={c.input} readOnly value={url} onFocus={(e) => e.target.select()} />
      </div>
      <div className={c.row}>
        <Button variant="primary" onClick={() => void copy(url, 'Link copied.')}>
          Copy link
        </Button>
        <Button onClick={() => void copy(text, 'Team copied as text.')}>Copy as text</Button>
        <Button onClick={() => void picture()}>Save picture</Button>
        {canShare && <Button onClick={() => void share()}>Share…</Button>}
      </div>
      {note && (
        <span className={note.ok ? c.message : c.error} role="status">
          {note.text}
        </span>
      )}
    </div>
  );
}

/** A 1080-wide PNG card of the team in HLITH's colours and the game's vent. Null when the browser can't draw. */
async function teamPicture(game: GameContract, team: SharedTeam, nameOf: (id: string) => string): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const css = getComputedStyle(document.documentElement);
  const token = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  const font = token('--font-words', 'system-ui, sans-serif');
  const rowH = 84;
  canvas.width = 1080;
  canvas.height = 220 + team.members.length * (rowH + 14) + 60;
  ctx.fillStyle = token('--bg-app', '#08090b');
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = game.vent;
  ctx.fillRect(0, 0, canvas.width, 6);
  ctx.font = `600 22px ${font}`;
  ctx.fillText(game.name.toUpperCase(), 48, 64);
  ctx.fillStyle = token('--ink-1', '#e6eef3');
  ctx.font = `800 46px ${font}`;
  ctx.fillText(team.name.length > 34 ? `${team.name.slice(0, 33)}…` : team.name, 48, 122);
  let y = 170;
  team.members.forEach((id, i) => {
    ctx.fillStyle = token('--bg-card', '#0e1115');
    ctx.beginPath();
    ctx.roundRect(48, y, 984, rowH, 12);
    ctx.fill();
    ctx.fillStyle = game.vent;
    ctx.font = `600 26px ${token('--font-numbers', 'monospace')}`;
    ctx.fillText(String(i + 1), 76, y + 52);
    ctx.fillStyle = token('--ink-1', '#e6eef3');
    ctx.font = `700 32px ${font}`;
    ctx.fillText(nameOf(id), 120, y + 54);
    y += rowH + 14;
  });
  ctx.fillStyle = token('--ink-4', '#6f8494');
  ctx.font = `400 22px ${font}`;
  ctx.textAlign = 'right';
  ctx.fillText('HLITH', 1032, canvas.height - 32);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}

// ── Opening a shared link ────────────────────────────────────────

const subscribeHash = (l: () => void) => {
  window.addEventListener('hashchange', l);
  return () => window.removeEventListener('hashchange', l);
};
const readHash = () => window.location.hash;

/** Drop the team from the address bar so it doesn't reopen; keeps the page and history as they are. */
function clearHash() {
  window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

/**
 * Mounted once (src/main.tsx): when the address has "#team=…", shows that team
 * read-only over whatever page is open, with "Save to my teams".
 */
export function SharedTeamRoute({ games }: { games: GameContract[] }) {
  const hash = useSyncExternalStore(subscribeHash, readHash, () => '');
  const has = new URLSearchParams(hash.slice(1)).has(FRAGMENT_KEY);
  if (!has) return null;
  const decoded = decodeTeam(hash);
  const game = decoded.ok ? games.find((g) => g.id === decoded.team.game) : undefined;
  return (
    <BottomSheet open side title={decoded.ok ? `Shared team · ${decoded.team.name}` : 'Shared team'} onClose={clearHash}>
      {!decoded.ok ? (
        <SharedProblem text={DECODE_TEXT[decoded.error]} />
      ) : !game ? (
        <SharedProblem text="This team is for a game HLITH doesn’t have." />
      ) : (
        <SharedTeamView key={hash} game={game} team={decoded.team} games={games} />
      )}
    </BottomSheet>
  );
}

function SharedProblem({ text }: { text: string }) {
  return (
    <div className={c.stack}>
      <span className={c.error} role="alert">
        {text}
      </span>
      <Button onClick={clearHash}>Close</Button>
    </div>
  );
}

/** Read-only view of a shared team, with "Save to my teams" (adds a new team; never replaces one). */
export function SharedTeamView({ game, team, games = [game], load }: { game: GameContract; team: SharedTeam; games?: GameContract[]; load?: CardLoader | null }) {
  const characters = useCharacters(game);
  const mine = useGameData(game.id);
  const [saved, setSaved] = useState(false);
  const same = mine.teams.some((t) => t.name === team.name && t.members.join() === team.members.join());
  const byId = new Map((characters ?? []).map((ch) => [ch.id, ch]));
  const unknownCount = characters ? team.members.filter((m) => !byId.has(m)).length : 0;

  const save = () => {
    saveTeam(game.id, { id: `team-${Date.now().toString(36)}`, name: team.name, members: team.members.filter((m) => byId.has(m)) });
    setSaved(true);
  };

  return (
    <div className={c.stack}>
      <div className={c.sheetBar}>
        <span className={c.muted}>
          {game.name} · shared with you · read-only
        </span>
        <Button variant="quiet" onClick={clearHash}>
          Close
        </Button>
      </div>
      {team.by && <SharedBy by={team.by} games={games} {...(load !== undefined ? { load } : {})} />}
      <ul className={c.memberGrid} aria-label="Team members">
        {team.members.map((m) => {
          const ch = byId.get(m);
          const entry = mine.roster[m];
          return (
            <li key={m}>
              <CharacterTile
                name={ch?.name ?? `Unknown (${m})`}
                subtitle={ch ? `${game.roles.find((r) => r.id === ch.role)?.label ?? ch.role} · ${game.elements.find((e) => e.id === ch.element)?.label ?? ch.element}` : 'Not in HLITH’s list'}
                rarity={ch?.rarity ?? 'mid'}
                rarityLabel={ch ? game.terms.rarity[ch.rarity] : '?'}
                elementColor={game.elements.find((e) => e.id === ch?.element)?.color ?? 'var(--ink-4)'}
                owned={entry?.owned ?? false}
                dupes={entry?.owned && game.dupes ? `${game.dupes.prefix}${entry.dupes}` : undefined}
                art={ch?.portrait ?? ch?.art}
              />
            </li>
          );
        })}
      </ul>
      <span className={c.muted}>“Not owned” is about your own roster, not the person who shared it.</span>
      {unknownCount > 0 && <span className={c.muted}>{unknownCount} of them aren’t in HLITH’s list yet and won’t be saved.</span>}
      <div className={c.row}>
        <Button variant="primary" disabled={saved || same || !characters || unknownCount === team.members.length} onClick={save}>
          {saved ? 'Saved' : same ? 'Already in your teams' : 'Save to my teams'}
        </Button>
        {saved && (
          <span className={c.message} role="status">
            Saved to Roster → Teams. Nothing else changed.
          </span>
        )}
      </div>
    </div>
  );
}
