import { describe, expect, it } from 'vitest';
import { signInInfo } from './session';

const identity = (provider: string, last: string) => ({ id: provider, identity_id: provider, user_id: 'u1', provider, identity_data: {}, last_sign_in_at: last, created_at: last, updated_at: last });

describe('signInInfo', () => {
  it('“signed in with” is the newest identity, not app_metadata.provider (the first method ever used)', () => {
    const info = signInInfo({
      app_metadata: { provider: 'discord', providers: ['discord', 'google'] },
      identities: [identity('discord', '2026-09-01T10:00:00Z'), identity('google', '2026-10-09T08:00:00Z')],
    });
    expect(info.provider).toBe('google');
    expect(info.methods).toEqual(['discord', 'google']);
  });

  it('falls back to app_metadata when the session has no identities list', () => {
    expect(signInInfo({ app_metadata: { provider: 'email' } })).toEqual({ provider: 'email', methods: ['email'] });
  });
});
