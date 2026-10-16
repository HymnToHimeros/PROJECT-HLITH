/**
 * The app side of the SKPort link: reading the ACCOUNT_TOKEN a player pastes,
 * keeping it on this device only when the player asks, and calling the
 * skport server function (supabase/functions/skport).
 *
 * Three ways to keep a token, chosen by the player:
 * - Use once (default): the value lives only in the form until the request is sent.
 * - Remember on this device: kept in this browser, encrypted, under hlith.secret.skport.sealed;
 *   never synced, never part of a backup.
 * - Save on HLITH's server: encrypted in Supabase Vault, needed for automatic
 *   check-in (migration 0022).
 * "Forget" deletes the device copy, or overwrites the server copy.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AccountLink, GameContract } from '../../core/contract';
import { isSealed, seal, unseal, vaultAvailable, vaultReady } from '../../core/data/deviceVault';

// ── Token reading ───────────────────────────────────────────────

/** The player's ACCOUNT_TOKEN from their SKPort browser cookies. */
export function readSkportToken(text: string): { ok: true; token: string } | { ok: false } {
  let trimmed = text.trim();
  // The browser shows the cookie URL-encoded (%2F for /); the server wants the plain value.
  if (/%[0-9A-Fa-f]{2}/.test(trimmed)) {
    try {
      trimmed = decodeURIComponent(trimmed);
    } catch {
      return { ok: false };
    }
  }
  if (!trimmed || trimmed.length < 10 || trimmed.length > 2000) return { ok: false };
  if (/[\s;,]/.test(trimmed)) return { ok: false };
  return { ok: true, token: trimmed };
}

// ── Device storage (encrypted) ──────────────────────────────────

const SEALED = 'hlith.secret.skport.sealed';

export interface SkportDeviceAccount {
  id: string;
  label: string;
  token: string;
  uid: string;
  nickname: string;
  server: string;
  savedAt: string;
}

let listeners: (() => void)[] = [];
export function onSkportDeviceAccounts(fn: () => void): () => void {
  listeners.push(fn);
  return () => { listeners = listeners.filter((f) => f !== fn); };
}
function notify(): void { for (const fn of listeners) fn(); }

let opened: SkportDeviceAccount[] | null = null;

export async function loadSkportDeviceAccounts(): Promise<SkportDeviceAccount[]> {
  if (opened) return opened;
  try {
    const raw = localStorage.getItem(SEALED);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!isSealed(parsed)) return [];
    const plain = await unseal(parsed);
    opened = Array.isArray(plain) ? (plain as SkportDeviceAccount[]).filter((a) => a && a.token && a.uid) : [];
    return opened;
  } catch { return []; }
}

export function skportDeviceAccounts(): SkportDeviceAccount[] {
  return opened ?? [];
}

async function writeSealed(list: SkportDeviceAccount[]): Promise<void> {
  opened = list;
  if (await vaultReady()) {
    try {
      localStorage.setItem(SEALED, JSON.stringify(await seal(list)));
    } catch { /* storage blocked */ }
  }
  notify();
}

export async function saveSkportDevice(account: Omit<SkportDeviceAccount, 'id' | 'savedAt'>): Promise<string> {
  const list = await loadSkportDeviceAccounts();
  const existing = list.find((a) => a.uid === account.uid);
  if (existing) {
    existing.token = account.token;
    existing.label = account.label;
    existing.nickname = account.nickname;
    existing.server = account.server;
    existing.savedAt = new Date().toISOString();
    await writeSealed(list);
    return existing.id;
  }
  const id = crypto.randomUUID();
  list.push({ ...account, id, savedAt: new Date().toISOString() });
  await writeSealed(list);
  return id;
}

export async function forgetSkportDevice(id: string): Promise<void> {
  const list = await loadSkportDeviceAccounts();
  await writeSealed(list.filter((a) => a.id !== id));
}

export const skportRememberWorks = vaultAvailable;

// ── Server calls ────────────────────────────────────────────────

export interface SkportAnswer {
  account: { uid: string; nickname: string; level: number | null; worldLevel: number | null; server: string };
  readAt: string;
  stamina?: { current: number; max: number; fullInSeconds: number } | null;
  checkin?: { checkedInToday: boolean; daysThisMonth: number | null; claimedNow: boolean } | null;
  problems: Record<string, { code: string; text: string }>;
}

export type SkportResult = { ok: true; answer: SkportAnswer } | { ok: false; text: string; roles?: Array<{ uid: string; nickname: string; server: string }> };

/** This game's SKPort link from its contract, or null when it has none. */
export const skportLink = (game: GameContract): AccountLink | null =>
  game.accountLinks?.find((l) => l.provider === 'skport') ?? null;

async function errorText(error: unknown, fallback: string): Promise<string> {
  const ctx = error && typeof error === 'object' && 'context' in error ? (error as { context: unknown }).context : null;
  const body: unknown = ctx instanceof Response ? await ctx.json().catch(() => null) : null;
  return body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string' ? (body as { error: string }).error : fallback;
}

/** Ask HLITH's server to read this player's SKPort data. */
export async function askSkport(
  client: SupabaseClient,
  args: { accountToken?: string; linkId?: string; uid?: string; want: ('account' | 'stamina' | 'checkin')[]; claim?: boolean },
): Promise<SkportResult> {
  const body: Record<string, unknown> = { want: args.want };
  if (args.linkId) body.linkId = args.linkId;
  else if (args.accountToken) body.accountToken = args.accountToken;
  if (args.uid) body.uid = args.uid;
  if (args.claim) body.claim = true;
  const { data, error } = await client.functions.invoke<SkportAnswer>('skport', { body });
  if (error || !data) return { ok: false, text: await errorText(error, 'HLITH\'s server couldn\'t be reached. Try again in a minute.') };
  return { ok: true, answer: data };
}

/** Save a SKPort token on the server. */
export async function saveSkportOnServer(
  client: SupabaseClient,
  args: { label: string; accountToken: string; uid?: string; linkId?: string },
): Promise<{ ok: true; data: { linkId: string; account: SkportAnswer['account'] } } | { ok: false; text: string }> {
  const body: Record<string, unknown> = { action: 'save', accountToken: args.accountToken, label: args.label };
  if (args.uid) body.uid = args.uid;
  if (args.linkId) body.linkId = args.linkId;
  const { data, error } = await client.functions.invoke<{ linkId: string; account: SkportAnswer['account'] }>('skport', { body });
  if (error || !data) return { ok: false, text: await errorText(error, 'Saving failed. Try again.') };
  return { ok: true, data };
}

/** Forget a saved SKPort token on the server. */
export async function forgetSkportOnServer(client: SupabaseClient, linkId: string): Promise<string | null> {
  const { error } = await client.functions.invoke('skport', { body: { action: 'forget', linkId } });
  return error ? 'Forgetting didn\'t go through. Try again.' : null;
}

// ── SKPort server account loading ───────────────────────────────

export interface SkportServerRow {
  id: string;
  label: string;
  skport_uid: string;
  server: string;
  nickname: string;
  auto_checkin: boolean;
  forgotten_at: string | null;
}

export interface SkportLinkedAccount {
  id: string;
  label: string;
  where: 'server' | 'device';
  skportUid: string;
  nickname: string;
  server: string;
  gameId: string;
  autoCheckin: boolean;
  token?: string;
}

export function skportFromServerRows(rows: SkportServerRow[]): SkportLinkedAccount[] {
  return rows
    .filter((r) => !r.forgotten_at)
    .map((r) => ({
      id: r.id,
      label: r.label,
      where: 'server' as const,
      skportUid: r.skport_uid,
      nickname: r.nickname,
      server: r.server,
      gameId: 'endfield',
      autoCheckin: r.auto_checkin,
    }));
}

export function skportFromDevice(list: SkportDeviceAccount[]): SkportLinkedAccount[] {
  return list.map((a) => ({
    id: a.id,
    label: a.label,
    where: 'device' as const,
    skportUid: a.uid,
    nickname: a.nickname,
    server: a.server,
    gameId: 'endfield',
    autoCheckin: false,
    token: a.token,
  }));
}

export function mergeSkportAccounts(server: SkportLinkedAccount[], device: SkportLinkedAccount[]): SkportLinkedAccount[] {
  const onServer = new Set(server.map((a) => a.skportUid));
  return [...server, ...device.filter((d) => !onServer.has(d.skportUid))];
}

const SKPORT_COLUMNS = 'id,label,skport_uid,server,nickname,auto_checkin,forgotten_at';

export async function loadSkportServer(client: SupabaseClient): Promise<SkportLinkedAccount[] | { error: string }> {
  const { data, error } = await client.from('skport_links').select(SKPORT_COLUMNS).order('created_at');
  if (error) return { error: 'Your saved SKPort accounts couldn\'t be loaded.' };
  return skportFromServerRows((data ?? []) as SkportServerRow[]);
}

export async function updateSkportAccount(client: SupabaseClient, id: string, change: Partial<{ label: string; auto_checkin: boolean }>): Promise<string | null> {
  const { error } = await client.from('skport_links').update(change).eq('id', id);
  return error ? 'That change couldn\'t be saved. Try again.' : null;
}
