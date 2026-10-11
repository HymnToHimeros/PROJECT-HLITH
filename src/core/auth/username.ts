/**
 * Username rules (T62), the same as on the server (public.username_status, migration 0016;
 * tests/firstRun.test.ts keeps the lists equal). The server decides; this gives instant hints.
 */
export const USERNAME = /^[A-Za-z0-9_.]{3,20}$/;

/** Names that could pass for HLIÐSKJÁLF or its staff: refused when a username contains one. The owner may use them. */
export const RESERVED = ['owner', 'admin', 'moderator', 'hlith', 'hlidskjalf', 'hliðskjálf', 'projecthlith', 'support', 'staff', 'official', 'system'];
/** Refused only as a word of their own (mod, mod_x, x.mod, mod123, m0d), not inside words like "model". */
export const RESERVED_WORDS = ['mod'];

/** A short list of slurs and swearing (words that hide inside ordinary ones are left out). */
export const BLOCKED = ['fuck', 'shit', 'cunt', 'bitch', 'whore', 'slut', 'nigger', 'nigga', 'faggot', 'retard', 'kike', 'chink', 'tranny', 'nazi', 'hitler', 'porn', 'pussy', 'bastard'];

/** Lower case, without . and _, look-alike digits read as letters (0 o, 1 i, 3 e, 4 a, 5 s, 7 t). */
export function usernameKey(name: string): string {
  const map: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '.': '', _: '' };
  return [...name.toLowerCase()].map((ch) => map[ch] ?? ch).join('');
}

export type UsernameStatus = 'ok' | 'yours' | 'taken' | 'invalid' | 'reserved' | 'blocked';

const words = (s: string) => s.split(/[^a-z]+/).filter(Boolean);

/** What can be told without asking the server ('ok' still needs the server's "free"). The owner may use reserved names. */
export function checkUsername(name: string, owner = false): 'ok' | 'invalid' | 'reserved' | 'blocked' {
  if (!USERNAME.test(name)) return 'invalid';
  const key = usernameKey(name);
  const lower = name.toLowerCase();
  const folded = [...lower].map((ch) => ({ '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't' })[ch] ?? ch).join('');
  const reserved = RESERVED.some((r) => key.includes(usernameKey(r))) || RESERVED_WORDS.some((w) => words(lower).includes(w) || words(folded).includes(w));
  if (reserved && !owner) return 'reserved';
  if (BLOCKED.some((b) => key.includes(b))) return 'blocked';
  return 'ok';
}

export const USERNAME_HINT: Record<UsernameStatus, string> = {
  ok: 'Available.',
  yours: 'That’s your username.',
  taken: 'Taken. Try another.',
  invalid: '3–20 letters, numbers, _ or .',
  reserved: 'Not allowed: it could pass for HLIÐSKJÁLF or its staff.',
  blocked: 'Not allowed. Pick something friendlier.',
};
