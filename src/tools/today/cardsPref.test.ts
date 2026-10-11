import { describe, expect, it } from 'vitest';
import { cleanToday, DEFAULT_TODAY, moveCard } from './cardsPref';

describe('Customise → Today cards (T52d)', () => {
  it('nothing saved = the design’s layout; every card exactly once', () => {
    expect(cleanToday(undefined)).toEqual(DEFAULT_TODAY);
    expect(cleanToday({ left: ['coming', 'coming', 'nope'], right: ['tasks'], hidden: ['wishlist', 'bad'] })).toEqual({
      left: ['coming', 'tonight', 'wishlist'],
      right: ['tasks', 'banners'],
      hidden: ['wishlist'],
    });
  });

  it('moves a card up, down and across, never off the ends', () => {
    const l = cleanToday(undefined);
    expect(moveCard(l, 'tonight', 'up').left).toEqual(['tonight', 'tasks', 'wishlist']);
    expect(moveCard(l, 'tasks', 'up')).toBe(l);
    expect(moveCard(l, 'coming', 'down')).toBe(l);
    const moved = moveCard(l, 'tasks', 'right');
    expect(moved).toMatchObject({ left: ['tonight', 'wishlist'], right: ['banners', 'coming', 'tasks'] });
  });
});
