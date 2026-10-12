/**
 * A public Telegram channel as a leak source (T78), read from its no-login web view
 * `https://t.me/s/<channel>` (the latest ~20 posts as HTML; older ones via `?before=<id>`).
 * No bot, account, phone number or key. Pure parsing and tagging here
 * (tests/telegramLeaks.test.ts); the fetching is in scripts/leaks-seele.ts and the
 * research routine (docs/ROUTINES.md) turns posts into findings and translates them.
 */

/** The one place for the channel. `channel` is the name in t.me/<channel>. */
export const SEELE = {
  channel: 'Seele_Leaks',
  /**
   * Finding source name. An approved leak shows it as its credit next to "UNVERIFIED", so it
   * is the public credit itself ("Source: Seele (Telegram)"); nothing about permission or partners.
   */
  name: 'Seele (Telegram)',
  credit: 'Source: Seele (Telegram)',
  /** Games whose posts become findings. Others are tagged and counted only (add 'gi' to switch Genshin on). */
  keep: ['hsr', 'zzz'] as GameTag[],
};

export const channelSet = (channel = SEELE.channel) => channel.trim() !== '' && channel !== 'SEELE_CHANNEL_NOT_SET';

export type GameTag = 'hsr' | 'zzz' | 'gi' | 'hi3' | 'other';

export interface Post {
  /** Post number in the channel; stable. */
  id: number;
  url: string;
  /** ISO time the post went up. */
  at: string;
  /** The post's text as written (line breaks kept). */
  text: string;
  /** Image links on Telegram's own servers (linked, never copied). */
  images: string[];
  games: GameTag[];
  /** The text is mostly Chinese: the routine adds an English translation. */
  chinese: boolean;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1));
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });

/** HTML of one message text block → plain text, line breaks kept. */
export function plainText(html: string): string {
  return decode(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/[ \t]+\n/g, '\n'),
  ).trim();
}

/**
 * Which games a post is about, from tags and names in English and Chinese. Seele tags a post
 * with its game first: 「HSR 4.7」, 「ZZZ 3.3」, 「HI3rd 9.2」, [ZZZ - 2.6 REL]. Untagged
 * posts (chat, replies) are "other".
 */
export function gamesOf(text: string): GameTag[] {
  const t = text.toLowerCase();
  const out: GameTag[] = [];
  if (/\bhsr\b|honkai\s*:?\s*star\s*rail|\bstar\s*rail\b|#starrail|星穹铁道|崩铁|星铁/.test(t)) out.push('hsr');
  if (/#zzz\b|\bzzz\b|zenless|绝区零/.test(t)) out.push('zzz');
  if (/[「[]\s*gi\b|#gi\b|#genshin|genshin|原神/.test(t)) out.push('gi');
  if (/\bhi3(rd)?\b|honkai\s*impact|崩坏\s*3|崩坏三/.test(t)) out.push('hi3');
  return out.length ? out : ['other'];
}

/** Mostly Chinese: Han characters make up at least a third of the letters, and no Japanese kana. */
export function isChinese(text: string): boolean {
  const letters = text.match(/[\p{L}]/gu) ?? [];
  if (!letters.length || /[぀-ヿ]/.test(text)) return false;
  const han = letters.filter((c) => /\p{Script=Han}/u.test(c)).length;
  return han / letters.length >= 1 / 3;
}

/** The posts on one web-view page, oldest first. */
export function parseChannelPage(html: string, channel: string): Post[] {
  const posts: Post[] = [];
  const blocks = html.split(/<div class="tgme_widget_message_wrap/).slice(1);
  for (const b of blocks) {
    const id = Number(new RegExp(`data-post="${channel}/(\\d+)"`, 'i').exec(b)?.[1]);
    const at = /<time datetime="([^"]+)"/.exec(b)?.[1];
    if (!Number.isFinite(id) || !at) continue;
    const textHtml = /<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/.exec(b)?.[1] ?? '';
    const text = plainText(textHtml);
    const images = [...b.matchAll(/class="tgme_widget_message_photo_wrap[^"]*"[^>]*background-image:url\('([^']+)'\)/g)].map((m) => (m[1]?.startsWith('//') ? `https:${m[1]}` : (m[1] ?? '')));
    posts.push({ id, url: `https://t.me/${channel}/${id}`, at: new Date(at).toISOString(), text, images, games: gamesOf(text), chinese: isChinese(text) });
  }
  return posts.sort((a, b) => a.id - b.id);
}

/** The id to ask for the page before this one (`?before=`), or undefined on the first post. */
export const olderPage = (posts: Post[]) => (posts.length && (posts[0]?.id ?? 0) > 1 ? posts[0]?.id : undefined);

export interface KnownLeak {
  game: string;
  /** Names and ids to look for (character names in our lists, nanoka ids, beta build numbers). */
  words: string[];
  what: string;
}

/**
 * The leaks we already show from nanoka.cc that this post names (same character or build),
 * so the routine doesn't deliver the same leak twice. Matches whole words, ignoring case.
 */
export function alreadyKnown(post: Post, known: KnownLeak[]): string[] {
  const t = post.text.toLowerCase();
  const hit = (w: string) => {
    const s = w.toLowerCase().trim();
    if (s.length < 3) return false;
    if (/\p{Script=Han}/u.test(s)) return t.includes(s);
    const esc = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^\\p{L}\\p{N}])${esc}($|[^\\p{L}\\p{N}])`, 'u').test(t);
  };
  return known.filter((k) => post.games.includes(k.game as GameTag) && k.words.some(hit)).map((k) => k.what);
}

/** Posts that should become findings: newer than `since`, about a kept game. */
export const wanted = (posts: Post[], since: number, keep: GameTag[] = SEELE.keep) => posts.filter((p) => Date.parse(p.at) > since && p.games.some((g) => keep.includes(g)));
