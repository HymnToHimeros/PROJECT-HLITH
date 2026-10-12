import { backend } from '../../../core/data/backend';
import type { ClaimRow, GrantRow, HeldReward, NewItem, OwnerItem, RewardItem } from './model';

export * from './model';

/*
 * Rewards (T67, migration 0019): the server calls. Every rule is the server's: owner only for
 * the catalogue, grants and codes; claim_reward refuses banned accounts and ones that haven't
 * finished first run; the card shows a worn reward only while it is held.
 */

export interface RewardsApi {
  mine(): Promise<HeldReward[]>;
  claim(code: string): Promise<{ status: 'claimed' | 'already'; item: RewardItem }>;
}
export interface OwnerRewardsApi {
  items(): Promise<OwnerItem[]>;
  addItem(item: NewItem): Promise<string>;
  grants(itemId: string): Promise<GrantRow[]>;
  grant(itemId: string, username: string, reason: string): Promise<'granted' | 'already'>;
  revoke(grantId: string, reason: string): Promise<boolean>;
  claims(): Promise<ClaimRow[]>;
  createClaim(itemId: string, maxUses: number, expiresAt: string | null, note: string): Promise<{ id: string; code: string }>;
  cancelClaim(id: string): Promise<boolean>;
}

const client = backend;

async function call<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  if (!client) throw new Error('This site runs without a server.');
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const serverRewards: RewardsApi | null = client
  ? {
      mine: async () => (await call<HeldReward[] | null>('my_rewards')) ?? [],
      claim: (code) => call('claim_reward', { p_code: code }),
    }
  : null;

export const serverOwnerRewards: OwnerRewardsApi | null = client
  ? {
      items: async () => (await call<OwnerItem[] | null>('owner_reward_items')) ?? [],
      addItem: (i) => call('add_reward_item', { p_kind: i.kind, p_art: i.art, p_name: i.name, p_exclusive: i.exclusive, p_event_name: i.eventName, p_event_date: i.eventDate }),
      grants: async (itemId) => (await call<GrantRow[] | null>('owner_reward_grants', { p_item: itemId })) ?? [],
      grant: (itemId, username, reason) => call('grant_reward', { p_item: itemId, p_username: username, p_reason: reason }),
      revoke: (grantId, reason) => call('revoke_reward', { p_grant: grantId, p_reason: reason }),
      claims: async () => (await call<ClaimRow[] | null>('owner_reward_claims')) ?? [],
      createClaim: (itemId, maxUses, expiresAt, note) => call('create_reward_claim', { p_item: itemId, p_max_uses: maxUses, p_expires_at: expiresAt, p_note: note }),
      cancelClaim: (id) => call('cancel_reward_claim', { p_id: id }),
    }
  : null;

