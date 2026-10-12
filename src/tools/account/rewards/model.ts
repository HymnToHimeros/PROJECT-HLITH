import type { RewardKind } from './pool';

/** Rewards (T67): the shapes and the pure rules, no server calls (rewardsData.ts has those). */

export interface RewardItem {
  id: string;
  kind: RewardKind;
  art: string;
  name: string;
  exclusive: boolean;
  event_name: string | null;
  event_date: string | null;
}
export interface HeldReward extends RewardItem {
  grant_id: string;
  source: 'direct' | 'claim';
  granted_at: string;
}
export interface OwnerItem extends RewardItem {
  created_at: string;
  holders: number;
}
export interface GrantRow {
  id: string;
  user_id: string;
  name: string | null;
  source: 'direct' | 'claim';
  granted_at: string;
  revoked_at: string | null;
}
export interface ClaimRow {
  id: string;
  item_id: string;
  note: string;
  max_uses: number;
  uses: number;
  expires_at: string | null;
  created_at: string;
  cancelled_at: string | null;
}
/** The rewards you wear on your card: item ids, one per kind. */
export interface WornRewards {
  badge: string | null;
  frame: string | null;
  name: string | null;
}
export const NO_REWARDS: WornRewards = { badge: null, frame: null, name: null };

export interface NewItem {
  kind: RewardKind;
  art: string;
  name: string;
  exclusive: boolean;
  eventName: string;
  eventDate: string | null;
}

/** "Exclusive · Launch week · 20 Oct 2026" — the tag on a reward. */
export function rewardTag(item: Pick<RewardItem, 'exclusive' | 'event_name' | 'event_date'>, formatDay: (ms: number) => string): string {
  const parts = [item.exclusive ? 'Exclusive' : 'Reward'];
  if (item.event_name) parts.push(item.event_name);
  if (item.event_date) {
    const ms = Date.parse(`${item.event_date}T00:00:00Z`);
    if (Number.isFinite(ms)) parts.push(formatDay(ms));
  }
  return parts.join(' · ');
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export function cleanWorn(raw: unknown): WornRewards {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const id = (v: unknown) => (typeof v === 'string' && UUID.test(v) ? v : null);
  return { badge: id(r.badge), frame: id(r.frame), name: id(r.name) };
}

/** What you wear, as items, from what you hold. A worn id you no longer hold drops out. */
export function wornItems(worn: WornRewards, held: readonly RewardItem[]): Partial<Record<RewardKind, RewardItem>> {
  const out: Partial<Record<RewardKind, RewardItem>> = {};
  for (const kind of ['badge', 'frame', 'name'] as const) {
    const item = held.find((h) => h.id === worn[kind] && h.kind === kind);
    if (item) out[kind] = item;
  }
  return out;
}

/** Claim codes as people type them: letters and digits, capitals (same as the server). */
export const codeKey = (code: string) => code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
/** "ABCD-EFGH-JKLM-NPQR" for showing. */
export const showCode = (code: string) => codeKey(code).replace(/(.{4})(?=.)/g, '$1-');

/** The card's worn rewards as the server sends them (profile_card → rewards), checked. */
export function serverRewards(raw: unknown): Partial<Record<RewardKind, RewardItem>> {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const out: Partial<Record<RewardKind, RewardItem>> = {};
  for (const kind of ['badge', 'frame', 'name'] as const) {
    const v = r[kind] && typeof r[kind] === 'object' ? (r[kind] as Record<string, unknown>) : null;
    if (!v || typeof v.art !== 'string' || !v.art.startsWith(`r-${kind}-`) || typeof v.name !== 'string' || typeof v.id !== 'string') continue;
    out[kind] = {
      id: v.id,
      kind,
      art: v.art,
      name: v.name.slice(0, 40),
      exclusive: v.exclusive !== false,
      event_name: typeof v.event_name === 'string' ? v.event_name.slice(0, 60) : null,
      event_date: typeof v.event_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.event_date) ? v.event_date : null,
    };
  }
  return out;
}
