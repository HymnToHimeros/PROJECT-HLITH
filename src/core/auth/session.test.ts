import { describe, expect, it } from 'vitest';
import { currentProvider } from './session';

describe('which login this session used', () => {
  it('uses the most recent sign-in, not the first provider ever used', () => {
    const user = {
      app_metadata: { provider: 'discord' },
      identities: [
        { provider: 'discord', last_sign_in_at: '2026-10-09T08:00:00Z' },
        { provider: 'google', last_sign_in_at: '2026-10-09T21:40:00Z' },
      ],
    };
    expect(currentProvider(user)).toBe('google');
  });
  it('falls back to app_metadata when identities are missing', () => {
    expect(currentProvider({ app_metadata: { provider: 'discord' } })).toBe('discord');
  });
});
