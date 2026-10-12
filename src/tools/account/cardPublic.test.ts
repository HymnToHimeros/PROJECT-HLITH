import { describe, expect, it } from 'vitest';
import { textBlocked } from '../../core/auth/username';
import type { BadgeState } from './badges';
import { BADGE_BY_ID } from './badges';
import { buildCard } from './cardData';
import { EMPTY_PROFILE, keepPublic, type Profile } from './profile';
import { fakeGame } from '../account-links/fakeGame';

const held = (...ids: (keyof typeof BADGE_BY_ID)[]): BadgeState[] => ids.map((id) => ({ def: BADGE_BY_ID[id], earned: true }));
const card = (profile: Partial<Profile>, badges: BadgeState[] = held('seated')) =>
  buildCard({ profile: { ...EMPTY_PROFILE, ...profile }, games: [fakeGame()], data: {}, characters: {}, badges, imageUrl: () => null, fallbackName: 'Mira', bannerFallback: '#000' });

describe('what others may read on the card (T64 B2)', () => {
  it('free text uses the username list word by word: “this hit” is fine, hidden swearing is not', () => {
    expect(textBlocked('I like this hit song')).toBe(false);
    expect(textBlocked('therapist and peacock')).toBe(false);
    expect(textBlocked('total sh1t')).toBe(true);
    expect(textBlocked('f.u.c.k')).toBe(true);
  });

  it('an earned title shows (with ✔) only while its badge is held; otherwise the typed title', () => {
    expect(card({ title: 'Seer', titleBadge: 'hundred' }, held('seated', 'hundred'))).toMatchObject({ title: 'Hundred-Caster', titleEarned: true });
    expect(card({ title: 'Seer', titleBadge: 'hundred' })).toMatchObject({ title: 'Seer', titleEarned: false });
    expect(card({ title: 'total shit' }).title).toBeNull();
  });

  it('the bio shows only when switched on and clean; favourite game and background come along', () => {
    expect(card({ bio: 'Hello' }).bio).toBeNull();
    expect(card({ bio: 'Hello', privacy: { ...EMPTY_PROFILE.privacy, bio: true } }).bio).toBe('Hello');
    expect(card({ bio: 'shit', privacy: { ...EMPTY_PROFILE.privacy, bio: true } }).bio).toBeNull();
    expect(card({ favGame: 'aa', cardBackground: 'bifrost' })).toMatchObject({ favGame: { short: 'AA' }, background: 'bifrost' });
  });

  it('silenced: the public parts stay as saved, private parts still change', () => {
    const saved = { ...EMPTY_PROFILE, displayName: 'Mira', bio: 'old', title: 'Seer' };
    const draft = { ...saved, displayName: 'New', bio: 'new', title: 'New', pinned: { aa: ['c1'] }, privacy: { ...saved.privacy, stats: false } };
    const kept = keepPublic(saved, draft);
    expect(kept).toMatchObject({ displayName: 'Mira', bio: 'old', title: 'Seer', pinned: { aa: ['c1'] } });
    expect(kept.privacy.stats).toBe(false);
  });
});
