/**
 * Your profile on the Account page: picture, banner, name, bio, pinned characters
 * and which showcase cards show. No React here.
 *
 * Where it lives:
 *  - This device only (no server): one key in this browser, `hlith.profile`. Pictures
 *    are shrunk in the browser and kept as small image text (data URLs). It goes into
 *    the backup file with everything else, and never leaves this browser otherwise.
 *  - Signed in: the columns added to public.profiles in 0004_profile.sql, and the
 *    pictures in the `avatars` storage bucket under your own folder (<user id>/…).
 *
 * Never wiped: unreadable saved text is kept under a backup key, not thrown away.
 */
import { cleanWorn, NO_REWARDS, type WornRewards } from './rewards/model';
import type { GameId } from '../../core/contract';
import { THEMES, type Theme } from '../../core/theme/themes';
import { isBadgeId, OWNER_TITLES, type BadgeId, type OwnerTitle } from './badges';
import { cleanOwnerStyle, DEFAULT_OWNER_STYLE, isDefaultOwnerStyle, type OwnerStyle } from './ownerArt/style';

export const BIO_MAX = 200;
export const NAME_MAX = 40;
export const PIN_MAX = 6;
export const TITLE_MAX = 60;
/** Showcase on the profile card: up to 4 favourite characters or teams. */
export const FEATURED_MAX = 4;
/** Badge shelf on the card: up to 3 favourite badges (T64 B2). */
export const SHELF_MAX = 3;
/** Largest picture you can pick, before it's shrunk. */
export const IMAGE_MAX_BYTES = 2 * 1024 * 1024;
export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

/** Showcase cards, in the order they show. */
export const CARD_IDS = ['games', 'sign-in', 'member-since', 'characters', 'pulls', 'pity', 'backlog'] as const;
export type CardId = (typeof CARD_IDS)[number];
export const CARD_LABEL: Record<CardId, string> = {
  games: 'Games you play',
  'sign-in': 'Sign-in methods',
  'member-since': 'Member since',
  characters: 'Characters owned',
  pulls: 'Pulls imported',
  pity: 'Current pity',
  backlog: 'Backlog progress',
};

/** Rings around the profile picture. 'sky' is the owner's own and only ever shows for the owner. */
export const FRAMES = ['none', 'frost', 'vent', 'gold', 'runes', 'sky'] as const;
export type FrameId = (typeof FRAMES)[number];
export const FRAME_LABEL: Record<FrameId, string> = { none: 'No frame', frost: 'Frost ring', vent: 'Game colour', gold: 'Gold', runes: 'Runes', sky: 'Sky and ravens' };

/** The colour your name shows in. 'accent' follows the accent colour (Account → Theme). */
export const NAME_COLORS = ['ink', 'accent', 'vent', 'gold'] as const;
export type NameColor = (typeof NAME_COLORS)[number];
export const NAME_COLOR_LABEL: Record<NameColor, string> = { ink: 'Plain', accent: 'Accent colour', vent: 'Game colour', gold: 'Gold' };

/** A character from a game's built-in list. */
export interface CharRef {
  game: GameId;
  id: string;
}
export type FeaturedItem = { kind: 'character'; game: GameId; id: string } | { kind: 'team'; game: GameId; id: string };

/** What a card someone else opens may show. Nothing shows to others unless `card` is on. */
export interface Privacy {
  /** Show my card to others (with a team I share). */
  card: boolean;
  stats: boolean;
  badges: boolean;
  showcase: boolean;
  /** T64 B2: the luckiest pull. */
  luck: boolean;
  /** T64 B2: the bio (off unless you switch it on). */
  bio: boolean;
}
export const DEFAULT_PRIVACY: Privacy = { card: false, stats: true, badges: true, showcase: true, luck: true, bio: false };
export const PRIVACY_LABEL: Record<keyof Privacy, string> = {
  card: 'Show my profile card with teams I share',
  stats: 'Include my pull numbers',
  badges: 'Include my badge',
  showcase: 'Include my showcase and best team',
  luck: 'Include my luckiest pull',
  bio: 'Include my bio',
};

export interface Profile {
  displayName: string | null;
  bio: string | null;
  /** Picture: a data URL (this device) or a storage path inside the avatars bucket (signed in). null = your initial. */
  avatar: string | null;
  /** Banner: same as avatar. null = the default gradient in your games' colours. */
  banner: string | null;
  /** Characters you pinned to the showcase, per game (ids from your owned roster). */
  pinned: Record<GameId, string[]>;
  /** Cards you switched off. Missing = shown. */
  hiddenCards: CardId[];
  /** A short line under your name. */
  title: string | null;
  frame: FrameId;
  nameColor: NameColor;
  /** The badge shown on your card; null = the highest one you hold. */
  pinnedBadge: BadgeId | null;
  /** T64 B2: up to 3 favourite badges on a shelf (only earned ones show). */
  pinnedShelf: BadgeId[];
  /** T64 B2: an earned title (the badge behind it); wins over the typed title while you hold it. */
  titleBadge: BadgeId | null;
  /** T64 B2: your favourite game, shown on the card. */
  favGame: GameId | null;
  /** T64 B2: a public theme's art behind your card (when there is no banner picture). */
  cardBackground: Theme | null;
  /** T64 B2: one saved team shown as your best team. */
  bestTeam: CharRef | null;
  /** The owner's choice of name for the owner badge (shown only for the owner). */
  ownerTitle: OwnerTitle | null;
  /** T64: the owner's badge, frame and name style (only ever used for the owner). */
  ownerStyle: OwnerStyle;
  /** T67: the rewards you wear (item ids); the card shows one only while you hold it. */
  rewards: WornRewards;
  /** A character as your picture / banner instead of an uploaded one. Wins over the upload while set. */
  avatarChar: CharRef | null;
  bannerChar: CharRef | null;
  featured: FeaturedItem[];
  privacy: Privacy;
  /** When it last changed (epoch ms). */
  updatedAt: number;
}

export const EMPTY_PROFILE: Profile = {
  displayName: null,
  bio: null,
  avatar: null,
  banner: null,
  pinned: {},
  hiddenCards: [],
  title: null,
  frame: 'none',
  nameColor: 'ink',
  pinnedBadge: null,
  pinnedShelf: [],
  titleBadge: null,
  favGame: null,
  cardBackground: null,
  bestTeam: null,
  ownerTitle: null,
  ownerStyle: DEFAULT_OWNER_STYLE,
  rewards: NO_REWARDS,
  avatarChar: null,
  bannerChar: null,
  featured: [],
  privacy: DEFAULT_PRIVACY,
  updatedAt: 0,
};

const text = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, max) : null;
};

/** Bios keep line breaks (at most two in a row). */
const bioText = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const t = v
    .replace(/\r\n?/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return t ? t.slice(0, BIO_MAX) : null;
};

const image = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);

const ID = /^[\w-]{1,40}$/;
const GAME = /^[a-z0-9-]{1,32}$/;
const charRef = (v: unknown): CharRef | null => {
  const r = v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
  return r && typeof r.game === 'string' && GAME.test(r.game) && typeof r.id === 'string' && ID.test(r.id) ? { game: r.game, id: r.id } : null;
};
const oneOf = <T extends string>(list: readonly T[], v: unknown, fallback: T): T => ((list as readonly unknown[]).includes(v) ? (v as T) : fallback);

function cleanFeatured(v: unknown): FeaturedItem[] {
  if (!Array.isArray(v)) return [];
  const out: FeaturedItem[] = [];
  for (const raw of v) {
    const ref = charRef(raw);
    const kind = (raw as { kind?: unknown } | null)?.kind;
    if (!ref || (kind !== 'character' && kind !== 'team')) continue;
    if (out.some((x) => x.kind === kind && x.game === ref.game && x.id === ref.id)) continue;
    out.push({ kind, ...ref });
    if (out.length >= FEATURED_MAX) break;
  }
  return out;
}

function cleanPrivacy(v: unknown): Privacy {
  const r = v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  const flag = (k: keyof Privacy) => (typeof r[k] === 'boolean' ? (r[k] as boolean) : DEFAULT_PRIVACY[k]);
  return { card: flag('card'), stats: flag('stats'), badges: flag('badges'), showcase: flag('showcase'), luck: flag('luck'), bio: flag('bio') };
}

/** Any stored or incoming value → a clean profile. Unknown fields are dropped, lengths and pin counts kept to the limits. */
export function cleanProfile(raw: unknown): Profile {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const pinnedRaw = r.pinned && typeof r.pinned === 'object' ? (r.pinned as Record<string, unknown>) : {};
  const pinned: Record<GameId, string[]> = {};
  for (const [game, ids] of Object.entries(pinnedRaw)) {
    if (!Array.isArray(ids)) continue;
    const list = [...new Set(ids.filter((x): x is string => typeof x === 'string' && x.length > 0))].slice(0, PIN_MAX);
    if (list.length) pinned[game] = list;
  }
  const hidden = Array.isArray(r.hiddenCards) ? r.hiddenCards.filter((c): c is CardId => (CARD_IDS as readonly string[]).includes(c as string)) : [];
  return {
    displayName: text(r.displayName, NAME_MAX),
    bio: bioText(r.bio),
    avatar: image(r.avatar),
    banner: image(r.banner),
    pinned,
    hiddenCards: [...new Set(hidden)],
    title: text(r.title, TITLE_MAX),
    frame: oneOf(FRAMES, r.frame, 'none'),
    nameColor: oneOf(NAME_COLORS, r.nameColor, 'ink'),
    pinnedBadge: isBadgeId(r.pinnedBadge) ? r.pinnedBadge : null,
    pinnedShelf: Array.isArray(r.pinnedShelf) ? [...new Set(r.pinnedShelf.filter(isBadgeId))].slice(0, SHELF_MAX) : [],
    bestTeam: charRef(r.bestTeam),
    titleBadge: isBadgeId(r.titleBadge) ? r.titleBadge : null,
    favGame: typeof r.favGame === 'string' && GAME.test(r.favGame) ? r.favGame : null,
    cardBackground: THEMES.some((t) => t.id === r.cardBackground) ? (r.cardBackground as Theme) : null,
    ownerTitle: oneOf<OwnerTitle | ''>([...OWNER_TITLES, ''], r.ownerTitle, '') || null,
    ownerStyle: cleanOwnerStyle(r.ownerStyle),
    rewards: cleanWorn(r.rewards),
    avatarChar: charRef(r.avatarChar),
    bannerChar: charRef(r.bannerChar),
    featured: cleanFeatured(r.featured),
    privacy: cleanPrivacy(r.privacy),
    updatedAt: typeof r.updatedAt === 'number' && Number.isFinite(r.updatedAt) ? r.updatedAt : 0,
  };
}

/** Add or take off one showcase item (max FEATURED_MAX). Returns the same profile when it's full. */
export function toggleFeatured(p: Profile, item: FeaturedItem): Profile {
  const same = (x: FeaturedItem) => x.kind === item.kind && x.game === item.game && x.id === item.id;
  if (p.featured.some(same)) return { ...p, featured: p.featured.filter((x) => !same(x)) };
  if (p.featured.length >= FEATURED_MAX) return p;
  return { ...p, featured: [...p.featured, item] };
}

/** Pin or unpin one character (max PIN_MAX per game). Returns the same profile when the pin is full. */
export function togglePin(p: Profile, game: GameId, characterId: string): Profile {
  const cur = p.pinned[game] ?? [];
  if (cur.includes(characterId)) {
    const next = cur.filter((x) => x !== characterId);
    const rest = Object.fromEntries(Object.entries(p.pinned).filter(([g]) => g !== game));
    return { ...p, pinned: next.length ? { ...rest, [game]: next } : rest };
  }
  if (cur.length >= PIN_MAX) return p;
  return { ...p, pinned: { ...p.pinned, [game]: [...cur, characterId] } };
}

export function setCardShown(p: Profile, card: CardId, shown: boolean): Profile {
  const hidden = shown ? p.hiddenCards.filter((c) => c !== card) : [...new Set([...p.hiddenCards, card])];
  return { ...p, hiddenCards: hidden };
}

// ── This device ─────────────────────────────────────────────────────
export const DEVICE_KEY = 'hlith.profile';

export function loadDeviceProfile(): Profile {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(DEVICE_KEY);
    return raw ? cleanProfile(JSON.parse(raw)) : EMPTY_PROFILE;
  } catch {
    try {
      if (raw) localStorage.setItem(`${DEVICE_KEY}.unreadable.${Date.now()}`, raw);
    } catch {
      /* storage unavailable */
    }
    return EMPTY_PROFILE;
  }
}

/** Saves on this device. Throws a plain-words error when the browser is out of room (pictures too big). */
export function saveDeviceProfile(p: Profile, now = Date.now()): Profile {
  const next = { ...cleanProfile(p), updatedAt: now };
  try {
    localStorage.setItem(DEVICE_KEY, JSON.stringify(next));
  } catch {
    throw new Error('This browser has no room left to save the profile. Try a smaller picture, or remove the banner.');
  }
  return next;
}

// ── Signed in: public.profiles row ──────────────────────────────────
/** The columns of public.profiles this page reads and writes (0001 + 0004_profile.sql). */
export interface ProfileRow {
  user_id: string;
  display_name: string | null;
  bio: string | null;
  avatar_path: string | null;
  banner_path: string | null;
  showcase: {
    pinned: Record<GameId, string[]>;
    hidden_cards: CardId[];
    /** T52: the card's look, showcase and privacy (read by public.profile_card() in 0011_profile_card.sql). */
    look?: { title: string | null; frame: FrameId; name_color: NameColor; pinned_badge: BadgeId | null; owner_title: OwnerTitle | null; owner_style?: OwnerStyle; rewards?: WornRewards; pinned_shelf?: BadgeId[]; best_team?: CharRef | null; title_badge?: BadgeId | null; fav_game?: GameId | null; card_background?: Theme | null; avatar_char: CharRef | null; banner_char: CharRef | null };
    featured?: FeaturedItem[];
    privacy?: Privacy;
  } | null;
  updated_at?: string;
}

export function toRow(p: Profile, userId: string): ProfileRow {
  const c = cleanProfile(p);
  if ([c.avatar, c.banner].some((x) => x?.startsWith('data:'))) throw new Error('Upload pictures before saving the row.');
  return {
    user_id: userId,
    display_name: c.displayName,
    bio: c.bio,
    avatar_path: c.avatar,
    banner_path: c.banner,
    showcase: {
      pinned: c.pinned,
      hidden_cards: c.hiddenCards,
      look: { title: c.title, frame: c.frame, name_color: c.nameColor, pinned_badge: c.pinnedBadge, owner_title: c.ownerTitle, owner_style: c.ownerStyle, rewards: c.rewards, pinned_shelf: c.pinnedShelf, best_team: c.bestTeam, title_badge: c.titleBadge, fav_game: c.favGame, card_background: c.cardBackground, avatar_char: c.avatarChar, banner_char: c.bannerChar },
      featured: c.featured,
      privacy: c.privacy,
    },
    updated_at: new Date(c.updatedAt || Date.now()).toISOString(),
  };
}

export function fromRow(row: Partial<ProfileRow> | null | undefined): Profile {
  if (!row) return EMPTY_PROFILE;
  const at = typeof row.updated_at === 'string' ? Date.parse(row.updated_at) : NaN;
  return cleanProfile({
    displayName: row.display_name,
    bio: row.bio,
    avatar: row.avatar_path,
    banner: row.banner_path,
    pinned: row.showcase?.pinned,
    hiddenCards: row.showcase?.hidden_cards,
    title: row.showcase?.look?.title,
    frame: row.showcase?.look?.frame,
    nameColor: row.showcase?.look?.name_color,
    pinnedBadge: row.showcase?.look?.pinned_badge,
    ownerTitle: row.showcase?.look?.owner_title,
    ownerStyle: row.showcase?.look?.owner_style,
    rewards: row.showcase?.look?.rewards,
    pinnedShelf: row.showcase?.look?.pinned_shelf,
    bestTeam: row.showcase?.look?.best_team,
    titleBadge: row.showcase?.look?.title_badge,
    favGame: row.showcase?.look?.fav_game,
    cardBackground: row.showcase?.look?.card_background,
    avatarChar: row.showcase?.look?.avatar_char,
    bannerChar: row.showcase?.look?.banner_char,
    featured: row.showcase?.featured,
    privacy: row.showcase?.privacy,
    updatedAt: Number.isFinite(at) ? at : 0,
  });
}

/** Path inside the avatars bucket. The first folder must be your user id (storage policy in 0004_profile.sql). */
export const storagePath = (userId: string, kind: 'avatar' | 'banner', type = 'image/jpeg') => `${userId}/${kind}.${type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg'}`;

/** Has the person filled in anything at all? */
export const isBlank = (p: Profile) =>
  !p.displayName &&
  !p.bio &&
  !p.avatar &&
  !p.banner &&
  Object.keys(p.pinned).length === 0 &&
  p.hiddenCards.length === 0 &&
  !p.title &&
  p.frame === 'none' &&
  p.nameColor === 'ink' &&
  !p.pinnedBadge &&
  p.pinnedShelf.length === 0 &&
  !p.bestTeam &&
  !p.titleBadge &&
  !p.favGame &&
  !p.cardBackground &&
  isDefaultOwnerStyle(p.ownerStyle) &&
  !p.rewards.badge &&
  !p.rewards.frame &&
  !p.rewards.name &&
  !p.avatarChar &&
  !p.bannerChar &&
  p.featured.length === 0;

// ── Pictures ────────────────────────────────────────────────────────
/** null when the file is fine, else why not, in plain words. */
export function checkImage(file: { type: string; size: number }): string | null {
  if (!IMAGE_TYPES.includes(file.type)) return 'That file isn’t a picture HLITH can use. Pick a PNG, JPG, WebP or GIF.';
  if (file.size > IMAGE_MAX_BYTES) return `That picture is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 2 MB.`;
  return null;
}

// Cropping, zoom and the saved sizes live in imageCrop.ts (maths) and imageRender.ts (drawing).

/** The part of a w×h picture that fills a target box (centred crop, like object-fit: cover). */
export function coverCrop(w: number, h: number, tw: number, th: number): { sx: number; sy: number; sw: number; sh: number } {
  const scale = Math.max(tw / w, th / h);
  const sw = Math.round(tw / scale);
  const sh = Math.round(th / scale);
  return { sx: Math.round((w - sw) / 2), sy: Math.round((h - sh) / 2), sw, sh };
}

export function dataUrlToBlob(url: string): Blob {
  const [head = '', body = ''] = url.split(',');
  const type = /data:([^;]+)/.exec(head)?.[1] ?? 'application/octet-stream';
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

// ── Silenced (T64 B2) ───────────────────────────────────────────────
/**
 * While an account is silenced, what others can see stays as it was: name, bio, pictures and
 * everything on the card. Private parts (pinned characters, hidden cards, privacy switches)
 * still save. The server holds the same line (profiles_silence_guard, 0018).
 */
export function keepPublic(saved: Profile, draft: Profile): Profile {
  return {
    ...draft,
    displayName: saved.displayName,
    bio: saved.bio,
    avatar: saved.avatar,
    banner: saved.banner,
    title: saved.title,
    frame: saved.frame,
    nameColor: saved.nameColor,
    pinnedBadge: saved.pinnedBadge,
    pinnedShelf: saved.pinnedShelf,
    titleBadge: saved.titleBadge,
    favGame: saved.favGame,
    cardBackground: saved.cardBackground,
    bestTeam: saved.bestTeam,
    ownerTitle: saved.ownerTitle,
    ownerStyle: saved.ownerStyle,
    rewards: saved.rewards,
    avatarChar: saved.avatarChar,
    bannerChar: saved.bannerChar,
    featured: saved.featured,
  };
}
