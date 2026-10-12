import { describe, expect, it } from 'vitest';
import { OWNER_BADGE_ART, OWNER_FRAME_ART, OWNER_FRAME_VARIANTS, OWNER_NAME_INFO } from './art';
import { cleanOwnerStyle, DEFAULT_OWNER_STYLE, OWNER_BADGES, OWNER_FRAMES, OWNER_NAMES, OWNER_SETS, wearSet, wornSet } from './style';

describe('the owner’s look (T64)', () => {
  it('has every badge, frame and name style the owner kept', () => {
    expect(OWNER_BADGE_ART).toHaveLength(OWNER_BADGES - 1); // badge 0 is the original in BadgeMark
    expect(OWNER_FRAME_ART).toHaveLength(OWNER_FRAMES);
    expect(OWNER_NAME_INFO).toHaveLength(OWNER_NAMES);
    // Frame 16 is not the window shape the owner turned down.
    expect(OWNER_FRAME_ART[15]?.name).not.toBe('Eclipse Window');
    // The owner kept all five round-2 Eclipse frames as frame 16's variants.
    expect(OWNER_FRAME_VARIANTS[16]?.map((f) => f.name)).toEqual(['Astronomical Clock', 'Two Crescents', 'Sköll & Hati', 'Armillary Sphere', 'Compass Rose']);
  });

  it('keeps only whole numbers in range; anything else falls back to the normal look', () => {
    expect(cleanOwnerStyle({ badge: 4, frame: 16, name: 20, frameVariant: 4 })).toEqual({ badge: 4, frame: 16, name: 20, frameVariant: 4, nameVariant: 0 });
    expect(cleanOwnerStyle({ frameVariant: 5, nameVariant: -1 })).toEqual(DEFAULT_OWNER_STYLE);
    expect(cleanOwnerStyle({ badge: 9, frame: 0, name: 21 })).toEqual(DEFAULT_OWNER_STYLE);
    expect(cleanOwnerStyle({ badge: '3', frame: 2.5, name: null })).toEqual(DEFAULT_OWNER_STYLE);
    expect(cleanOwnerStyle(undefined)).toEqual(DEFAULT_OWNER_STYLE);
  });

  it('each round-3 badge has its own frame and name style; “Wear full set” puts on all three', () => {
    expect(OWNER_SETS.map((s) => [s.badge, s.frame, s.nameStyle])).toEqual([1, 2, 3, 4, 5, 6, 7, 8].map((n) => [n, n + 12, n + 12]));
    const set = OWNER_SETS[3];
    if (!set) throw new Error('no set 4');
    const worn = wearSet(set);
    expect(worn).toEqual({ badge: 4, frame: 16, name: 16, frameVariant: 0, nameVariant: 0 });
    expect(wornSet(worn)?.name).toBe('Sól & Máni');
    // Mixing is fine, it just isn't a full set any more.
    expect(wornSet({ ...worn, name: 2 })).toBeUndefined();
  });
});
