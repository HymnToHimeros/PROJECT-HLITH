/**
 * New HSR/ZZZ posts on the Seele Telegram channel (`npm run leaks:seele`), for the
 * research routine (docs/ROUTINES.md, step 3). Reads the public web view only
 * (scripts/leaks/telegram.ts); no login, bot or key.
 *
 *   node scripts/leaks-seele.ts                  posts of the last 48 hours as JSON
 *   node scripts/leaks-seele.ts --hours 24 --out /tmp/seele.json
 *   node scripts/leaks-seele.ts --check          only `seele_new=<n>`: new HSR/ZZZ posts in the
 *                                                last 24 hours that we don't show yet (start check)
 *
 * Each post carries `known`: leaks we already show from nanoka.cc that it names (same
 * character), so the routine doesn't deliver them twice. Posts about other games are
 * only counted (`ignored`).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { alreadyKnown, channelSet, olderPage, parseChannelPage, SEELE, wanted, type KnownLeak, type Post } from './leaks/telegram.ts';

const ROOT = resolve(import.meta.dirname, '..');
const HOUR = 3_600_000;
const MAX_PAGES = 10;

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const check = process.argv.includes('--check');
const hours = Number(arg('hours') ?? (check ? 24 : 48));
const since = Date.now() - hours * HOUR;
const channel = arg('channel') ?? SEELE.channel;

/** Characters we already show as leaks or as not out yet, per game. */
function knownLeaks(): KnownLeak[] {
  return SEELE.keep.flatMap((game) => {
    let list: { id: string; name: string; leak?: unknown; releasedAt?: string }[] = [];
    try {
      list = JSON.parse(readFileSync(resolve(ROOT, `src/games/${game}/data/characters.json`), 'utf8')) as typeof list;
    } catch {
      return [];
    }
    return list
      .filter((c) => c.leak || (c.releasedAt && Date.parse(c.releasedAt) > Date.now()))
      .map((c) => ({ game, words: [...new Set([c.name, c.name.replace(/\s*★\s*/g, ' '), c.id])], what: `${c.name} (${c.leak ? 'leak' : 'not out yet'}, in our lists)` }));
  });
}

async function page(before?: number): Promise<Post[]> {
  const url = `https://t.me/s/${channel}${before ? `?before=${before}` : ''}`;
  const res = await fetch(url, { headers: { 'user-agent': 'PROJECT-HLITH leak check (public web view)' } });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return parseChannelPage(await res.text(), channel);
}

if (!channelSet(channel)) {
  console.log('seele: channel not set yet (SEELE.channel in scripts/leaks/telegram.ts)');
  if (check) console.log('seele_new=0');
  process.exit(0);
}

const seen = new Map<number, Post>();
try {
  let before: number | undefined;
  for (let i = 0; i < MAX_PAGES; i++) {
    const posts = await page(before);
    for (const p of posts) seen.set(p.id, p);
    before = olderPage(posts);
    if (!before || Date.parse(posts[0]?.at ?? '') <= since) break;
  }
} catch (e) {
  console.error(`seele: could not read the channel: ${e instanceof Error ? e.message : String(e)}`);
  if (check) {
    console.log('seele_new=0');
    process.exit(0);
  }
  process.exit(1);
}

const all = [...seen.values()].sort((a, b) => a.id - b.id);
const known = knownLeaks();
const posts = wanted(all, since).map((p) => ({ ...p, known: alreadyKnown(p, known) }));
const fresh = posts.filter((p) => !p.known.length);

if (check) {
  console.log(`seele_new=${fresh.length}`);
} else {
  const ignored: Record<string, number> = {};
  for (const p of all.filter((x) => Date.parse(x.at) > since && !posts.some((y) => y.id === x.id))) for (const g of p.games) ignored[g] = (ignored[g] ?? 0) + 1;
  const out = JSON.stringify({ channel, source: { name: SEELE.name, credit: SEELE.credit }, since: new Date(since).toISOString(), posts, ignored }, null, 2);
  const file = arg('out');
  if (file) writeFileSync(file, `${out}\n`);
  else console.log(out);
  console.error(`seele: ${posts.length} HSR/ZZZ posts since ${new Date(since).toISOString()} (${fresh.length} not in our lists yet); other games: ${JSON.stringify(ignored)}`);
}
