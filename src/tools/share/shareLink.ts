/**
 * Share a team (R54) without a server: the team travels inside the link, after
 * the "#". Browsers never send the part after "#" to any server (URL standard),
 * so a shared team isn't stored or seen anywhere but in the link itself.
 * The link holds only the game id, the team name and the character ids.
 */
export const FRAGMENT_KEY = 'team';
const MAX_MEMBERS = 8;
const MAX_NAME = 60;

export interface SharedTeam {
  game: string;
  name: string;
  members: string[];
}

const toBase64Url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromBase64Url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (ch) => ch.charCodeAt(0));

export function encodeTeam(team: SharedTeam): string {
  const payload = { v: 1, g: team.game, n: team.name.slice(0, MAX_NAME), m: team.members.slice(0, MAX_MEMBERS) };
  return toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
}

export type DecodeError = 'missing' | 'broken' | 'empty';

/** Read a team from a link, a fragment ("#team=…") or the bare code. Never trusts it: checks every field. */
export function decodeTeam(input: string): { ok: true; team: SharedTeam } | { ok: false; error: DecodeError } {
  const hash = input.includes('#') ? input.slice(input.indexOf('#') + 1) : input;
  const code = new URLSearchParams(hash).get(FRAGMENT_KEY) ?? (hash.includes('=') ? null : hash);
  if (!code) return { ok: false, error: 'missing' };
  try {
    if (code.length > 4000 || !/^[A-Za-z0-9_-]+$/.test(code)) return { ok: false, error: 'broken' };
    const raw: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(fromBase64Url(code)));
    if (!raw || typeof raw !== 'object') return { ok: false, error: 'broken' };
    const o = raw as { v?: unknown; g?: unknown; n?: unknown; m?: unknown };
    if (o.v !== 1 || typeof o.g !== 'string' || !/^[a-z0-9-]{1,32}$/.test(o.g)) return { ok: false, error: 'broken' };
    const members = Array.isArray(o.m) ? o.m.filter((x): x is string => typeof x === 'string' && /^[\w-]{1,40}$/.test(x)).slice(0, MAX_MEMBERS) : [];
    if (members.length === 0) return { ok: false, error: 'empty' };
    const name = typeof o.n === 'string' && o.n.trim() ? o.n.trim().slice(0, MAX_NAME) : 'Shared team';
    return { ok: true, team: { game: o.g, name, members: [...new Set(members)] } };
  } catch {
    return { ok: false, error: 'broken' };
  }
}

export const DECODE_TEXT: Record<DecodeError, string> = {
  missing: 'This link has no team in it.',
  broken: 'This team link is damaged. Ask for the link again, and copy all of it.',
  empty: 'This team link has nobody in it.',
};

/** The full link: opens the game's Roster, where the team shows read-only. */
export const shareUrl = (origin: string, team: SharedTeam) => `${origin}/${team.game}/roster#${FRAGMENT_KEY}=${encodeTeam(team)}`;

/** Plain text for chats: name, game, members in order. */
export function teamAsText(gameName: string, team: SharedTeam, nameOf: (id: string) => string, url?: string): string {
  return [`${team.name} · ${gameName}`, ...team.members.map((id, i) => `${i + 1}. ${nameOf(id)}`), ...(url ? ['', url] : [])].join('\n');
}
