/**
 * "Server time": many games end banners and events at the same clock time on every
 * server, so the real moment differs per server. Items carrying `serverTime` are
 * written in one server's clock (`base` = its UTC offset); this moves the flagged
 * times to the user's server. Without a chosen server they stay as written (the
 * earliest server for Asia-based data, so nothing is shown later than it is).
 */
const HOUR = 3_600_000;

interface Timed {
  start: string;
  end: string;
  serverTime?: { base: number; start?: boolean; end?: boolean } | undefined;
}

const shift = (iso: string, hours: number) => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t + hours * HOUR).toISOString() : iso;
};

/** One item at a server with this UTC offset (undefined = no server chosen: unchanged). */
export function atServer<T extends Timed>(item: T, offset: number | undefined): T {
  const st = item.serverTime;
  if (!st || offset === undefined || st.base === offset || (!st.start && !st.end)) return item;
  const hours = st.base - offset;
  return { ...item, ...(st.start ? { start: shift(item.start, hours) } : {}), ...(st.end ? { end: shift(item.end, hours) } : {}) };
}

/** A list at the user's server. Returns the same array when nothing changes. */
export function listAtServer<T extends Timed>(list: T[], offset: number | undefined): T[] {
  if (offset === undefined || !list.some((x) => x.serverTime)) return list;
  return list.map((x) => atServer(x, offset));
}

/** The UTC offset of the user's chosen server for a game, if one is chosen. */
export function serverOffset(game: { id: string; servers: { id: string; utcOffset: number }[] }, servers: Record<string, string>): number | undefined {
  return game.servers.find((s) => s.id === servers[game.id])?.utcOffset;
}
