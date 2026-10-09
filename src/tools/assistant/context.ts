/**
 * What the Assistant knows about you: a compact text summary of your real data
 * (never examples), plus a lookup the app uses to check its proposals.
 * Built fresh before each message from the game records and userData.
 */
import type { BacklogItem, Banner, Character, GameContract, GameEvent } from '../../core/contract';
import { balances, gameData, type GameUserData } from '../../core/data/userData';
import { mergeOwnItems } from '../edit-mode/merge';
import { buildTasks } from '../today/tasks';

export interface GameLookup {
  game: GameContract;
  serverId: string | undefined;
  user: GameUserData;
  characters: Map<string, Character>;
  events: Map<string, GameEvent>;
  backlog: Map<string, BacklogItem>;
  banners: Banner[];
  /** Today's tasks by id (only when your server is chosen). */
  tasks: Map<string, { label: string; done: boolean }>;
}
export type Lookup = Map<string, GameLookup>;

/** Load every list for the games in view. */
export async function loadLookup(games: GameContract[], servers: Record<string, string>, now: number): Promise<Lookup> {
  const out: Lookup = new Map();
  for (const game of games) {
    const [characters, events, backlog, banners] = await Promise.all([game.data.characters(), game.data.events(), game.data.backlog(), game.data.banners()]);
    const user = gameData(game.id);
    const ev = mergeOwnItems('events', events, user.ownItems.events);
    const bl = mergeOwnItems('backlog', backlog, user.ownItems.backlog);
    const bn = mergeOwnItems('banners', banners, user.ownItems.banners);
    const serverId = servers[game.id];
    const farmNames = user.farm.map((id) => characters.find((c) => c.id === id)?.name ?? id);
    const tasks = serverId ? buildTasks({ game, serverId, user, events: ev, farmNames, now }) : [];
    out.set(game.id, {
      game,
      serverId,
      user,
      characters: new Map(characters.map((c) => [c.id, c])),
      events: new Map(ev.map((e) => [e.id, e])),
      backlog: new Map(bl.map((b) => [b.id, b])),
      banners: bn,
      tasks: new Map(tasks.map((t) => [t.id, { label: t.label, done: t.done }])),
    });
  }
  return out;
}

const DAY = 86_400_000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';

/** The text the Assistant reads. Ids are included so it can propose changes. */
export function summarize(lookup: Lookup, now: number, maxChars = 22_000): string {
  const offset = -new Date(now).getTimezoneOffset() / 60;
  const lines: string[] = [`Now: ${iso(now)} (the user's local time is UTC${offset >= 0 ? '+' : ''}${offset}).`];
  if (lookup.size === 0) lines.push('No games switched on.');
  for (const l of lookup.values()) {
    const { game, user } = l;
    lines.push('', `## Game "${game.id}": ${game.name}`);
    const server = game.servers.find((s) => s.id === l.serverId);
    lines.push(`Server: ${server ? server.label : 'not chosen yet'}.`);
    const bank = balances(user.ledger);
    lines.push(
      'Currencies (id: name, balance from the bank log): ' +
        game.currencies
          .map((c) => {
            const v = bank.known ? bank.value[c.id] : undefined;
            return `${c.id}: ${c.name}${c.perPull ? ` (${c.perPull} per pull)` : ''}, ${v === undefined ? 'no data yet' : v}`;
          })
          .join('; '),
    );
    lines.push(`Pull history stored: ${user.pulls.length ? `${user.pulls.length} pulls, latest ${user.pulls[user.pulls.length - 1]?.time ?? '?'}` : 'none yet'}.`);
    const owned = Object.entries(user.roster).filter(([, r]) => r.owned);
    const wanted = Object.entries(user.roster).filter(([, r]) => r.wanted);
    const name = (id: string) => l.characters.get(id)?.name ?? id;
    lines.push(`Owned characters (id=name, dupes): ${owned.length ? owned.map(([id, r]) => `${id}=${name(id)} ${game.dupes ? `${game.dupes.prefix}${r.dupes}` : ''}`.trim()).join(', ') : 'none marked yet'}.`);
    lines.push(`Wanted: ${wanted.length ? wanted.map(([id]) => `${id}=${name(id)}`).join(', ') : 'none marked yet'}.`);
    if (user.farm.length) lines.push(`Farm list: ${user.farm.map(name).join(', ')}.`);

    const events = [...l.events.values()].filter((e) => Date.parse(e.end) > now - DAY && Date.parse(e.start) < now + 30 * DAY);
    lines.push(
      events.length
        ? 'Events (id | title | kind | start → end | reward | your state):\n' +
            events
              .map((e) => {
                const p = user.events[e.id];
                return `- ${e.id} | ${e.title} | ${e.kind} | ${iso(Date.parse(e.start))} → ${iso(Date.parse(e.end))} | ${e.reward === null ? 'reward unknown' : `${e.reward} ${e.currency}`} | ${p?.state ?? 'open'}${e.loginDays ? `, ${p?.daysClaimed ?? 0}/${e.loginDays} days claimed` : ''}`;
              })
              .join('\n')
        : 'Events: no event list for now.',
    );
    const backlog = [...l.backlog.values()];
    lines.push(
      backlog.length
        ? 'Backlog (id | title | category | done/total | reward):\n' +
            backlog.map((b) => `- ${b.id} | ${b.title} | ${b.category} | ${user.backlog[b.id] ?? 0}/${b.total} | ${b.reward === null ? 'reward unknown' : `${b.reward} ${b.currency}`}`).join('\n')
        : 'Backlog: no backlog list yet.',
    );
    const banners = l.banners.filter((b) => Date.parse(b.end) > now && Date.parse(b.start) < now + 45 * DAY);
    lines.push(
      banners.length
        ? 'Banners (title | featured | start → end):\n' +
            banners.map((b) => `- ${b.title} | ${b.featured.map(name).join(', ') || '?'} | ${iso(Date.parse(b.start))} → ${iso(Date.parse(b.end))}${b.leak ? ` | UNVERIFIED leak (${b.leak.source})` : ''}`).join('\n')
        : 'Banners: no banner list for now.',
    );
    lines.push(
      l.tasks.size
        ? "Today's tasks (id | task | done):\n" + [...l.tasks.entries()].map(([id, t]) => `- ${id} | ${t.label} | ${t.done ? 'done' : 'open'}`).join('\n')
        : "Today's tasks: choose a server first.",
    );
    const plans = user.plans.filter((p) => p.status === 'active' && Date.parse(p.end ?? p.start) > now - DAY);
    if (plans.length) lines.push('Plans: ' + plans.map((p) => `${p.title} (${iso(Date.parse(p.start))})`).join('; '));
    const all = [...l.characters.values()].map((c) => `${c.id}=${c.name}`).join(', ');
    lines.push(`All characters in the game list (id=name): ${all.length > 2500 ? `${all.slice(0, 2500)}…` : all || 'no list yet'}`);
  }
  const text = lines.join('\n');
  return text.length > maxChars ? `${text.slice(0, maxChars)}\n…(summary cut short)` : text;
}
