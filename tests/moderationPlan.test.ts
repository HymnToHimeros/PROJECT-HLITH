// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { authBan, FOREVER, readRequest } from '../supabase/functions/_shared/moderationPlan';

const U = '22222222-2222-4222-8222-222222222222';

describe('moderation: the sign-in ban (T60b)', () => {
  it('bans the sign-in for a ban or a removal, lifts it on unban or undo, and leaves it alone for silence', () => {
    expect(authBan('ban', 24)).toBe('24h');
    expect(authBan('ban', 168)).toBe('168h');
    expect(authBan('ban', null)).toBe(FOREVER);
    expect(authBan('remove', null)).toBe(FOREVER);
    expect(authBan('unban', null)).toBe('none');
    expect(authBan('undo_remove', null)).toBe('none');
    expect(authBan('silence', 24)).toBeNull();
    expect(authBan('lift_silence', null)).toBeNull();
  });

  it('accepts only known actions, an account id, and 24 hours, 7 days or no end', () => {
    expect(readRequest({ user_id: U, action: 'ban', hours: 168, reason: '  spam  ' })).toEqual({ user_id: U, action: 'ban', hours: 168, reason: 'spam' });
    expect(readRequest({ user_id: U, action: 'silence' })).toEqual({ user_id: U, action: 'silence', hours: null, reason: '' });
    expect(readRequest({ user_id: U, action: 'delete' })).toMatch(/Unknown action/);
    expect(readRequest({ user_id: U, action: 'ban', hours: 5 })).toMatch(/24 hours/);
    expect(readRequest({ user_id: 'nope', action: 'ban' })).toMatch(/user_id/);
    expect(readRequest(null)).toMatch(/Send JSON/);
    expect((readRequest({ user_id: U, action: 'ban', reason: 'x'.repeat(400) }) as { reason: string }).reason).toHaveLength(300);
  });
});
