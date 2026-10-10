/**
 * Everything the Calendar draws, as plain items: banners, events, endgame
 * cycles, version ends and weekly resets for one game. Pure: no React.
 */
import type { Banner, Character, GameContract, GameEvent, Version } from '../../core/contract';
import { serverRule, weekStart } from '../../core/time/reset';
import { exampleVersionEnd } from '../pulls/examples';
import { exampleCycles } from './examples';

const DAY = 86_400_000;

export type Lane = 'banners' | 'events' | 'endgame' | 'version';

export interface Span {
  id: string;
  game: GameContract;
  lane: Lane;
  title: string;
  start: number;
  end: number;
  leak?: { source: string } | undefined;
  example: boolean;
}

export interface Moment {
  id: string;
  game: GameContract;
  at: number;
  text: string;
  leak?: { source: string } | undefined;
  example: boolean;
}

export interface GameTimeline {
  spans: Span[];
  /** Weekly resets in the window; null when the server isn't chosen. */
  resets: number[] | null;
  example: { banners: boolean; events: boolean; endgame: boolean; version: boolean };
}

interface Input {
  game: GameContract;
  serverId: string | undefined;
  characters: Character[];
  banners: Banner[];
  events: GameEvent[];
  versions: Version[];
  now: number;
  from: number;
  to: number;
  /** Fill empty lanes with examples (Account → Example data). Default on. */
  examples?: boolean;
  /** Which banners and events are examples (from withOwnItems). */
  exampleIds?: ReadonlySet<string> | undefined;
}

export function gameTimeline({ game, serverId, banners, events, versions, now, from, to, examples: showExamples = true, exampleIds }: Input): GameTimeline {
  const spans: Span[] = [];
  const inWindow = (s: number, e: number) => e > from && s < to;

  // Banners and events arrive already mixed: the game's lists, your own items and, while a
  // list is empty, its examples one by one (`exampleIds`, the same ones every screen uses).
  const isExample = (id: string) => Boolean(exampleIds?.has(id));
  const typeLabel = (id: string) => game.bannerTypes.find((t) => t.id === id)?.label ?? id;
  for (const b of banners) {
    spans.push({ id: `banner:${b.id}`, game, lane: 'banners', title: `${b.title} · ${typeLabel(b.type)}`, start: Date.parse(b.start), end: Date.parse(b.end), leak: b.leak, example: isExample(b.id) });
  }
  const exBanners = banners.some((b) => isExample(b.id));

  // Events and endgame: endgame comes from endgame events, else from cycle rows with a known start, else examples.
  const eventList = events;
  const exEvents = events.some((e) => isExample(e.id));
  for (const e of eventList) {
    spans.push({ id: `event:${e.id}`, game, lane: e.kind === 'endgame' ? 'endgame' : 'events', title: e.title, start: Date.parse(e.start), end: Date.parse(e.end), leak: e.leak, example: isExample(e.id) });
  }
  let exEndgame = false;
  if (!eventList.some((e) => e.kind === 'endgame')) {
    for (const row of game.income) {
      if (row.schedule.kind !== 'cycle' || !row.schedule.anchor) continue;
      const len = row.schedule.days * DAY;
      const anchor = Date.parse(row.schedule.anchor);
      for (let s = anchor + Math.floor((from - anchor) / len) * len; s < to; s += len) {
        spans.push({ id: `cycle:${row.id}:${s}`, game, lane: 'endgame', title: row.label, start: s, end: s + len, example: false });
      }
    }
    const examples = showExamples ? exampleCycles(game, now) : [];
    exEndgame = examples.length > 0;
    for (const c of examples) spans.push({ id: c.id, game, lane: 'endgame', title: c.title, start: c.start, end: c.end, example: true });
  }

  // Versions.
  const exVersion = versions.length === 0 && showExamples;
  if (exVersion) {
    const end = exampleVersionEnd(now);
    spans.push({ id: 'version:example-current', game, lane: 'version', title: 'Current version', start: end - 42 * DAY, end, example: true });
  } else {
    for (const v of versions) spans.push({ id: `version:${v.id}`, game, lane: 'version', title: `Version ${v.id}`, start: Date.parse(v.start), end: Date.parse(v.end), example: false });
  }

  // Weekly resets for your server.
  let resets: number[] | null = null;
  if (serverId && game.servers.some((s) => s.id === serverId)) {
    const rule = serverRule(game, serverId);
    resets = [];
    for (let t = weekStart(from, rule); t <= to; t += 7 * DAY) if (t >= from) resets.push(t);
  }

  return {
    spans: spans.filter((s) => Number.isFinite(s.start) && Number.isFinite(s.end) && inWindow(s.start, s.end)),
    resets,
    example: { banners: exBanners, events: exEvents, endgame: exEndgame, version: exVersion },
  };
}

const VERBS: Record<Lane, [string, string]> = {
  banners: ['opens', 'leaves'],
  events: ['starts', 'ends'],
  endgame: ['new cycle starts', 'cycle ends'],
  version: ['starts', 'ends'],
};

/** The list under the timeline: every start, end and reset from now to the window's end, in date order. */
export function moments(timelines: { game: GameContract; timeline: GameTimeline }[], now: number, to: number): Moment[] {
  const out: Moment[] = [];
  for (const { game, timeline } of timelines) {
    for (const s of timeline.spans) {
      const [opens, closes] = VERBS[s.lane];
      if (s.start >= now && s.start <= to) out.push({ id: `${s.id}:start`, game, at: s.start, text: `${s.title} ${opens}`, leak: s.leak, example: s.example });
      if (s.end >= now && s.end <= to) out.push({ id: `${s.id}:end`, game, at: s.end, text: `${s.title} ${closes}`, leak: s.leak, example: s.example });
    }
    for (const r of timeline.resets ?? []) if (r >= now && r <= to) out.push({ id: `reset:${game.id}:${r}`, game, at: r, text: 'Weekly reset', example: false });
  }
  return out.sort((a, b) => a.at - b.at || a.text.localeCompare(b.text));
}
