import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BIO_MAX,
  checkImage,
  cleanProfile,
  coverCrop,
  DEVICE_KEY,
  EMPTY_PROFILE,
  fromRow,
  isBlank,
  loadDeviceProfile,
  PIN_MAX,
  saveDeviceProfile,
  setCardShown,
  storagePath,
  togglePin,
  toRow,
} from './profile';
import { accountStore } from './useProfile';

beforeEach(() => localStorage.clear());

describe('profile values', () => {
  it('cleans anything stored: trims, caps lengths and pins, drops unknown cards', () => {
    const p = cleanProfile({
      displayName: '   Mira   ',
      bio: `${'x'.repeat(BIO_MAX + 50)}`,
      pinned: { aa: ['1', '1', '2', '3', '4', '5', '6', '7'], bb: 'nope', cc: [] },
      hiddenCards: ['pulls', 'made-up', 'pulls'],
      extra: 'dropped',
    });
    expect(p.displayName).toBe('Mira');
    expect(p.bio).toHaveLength(BIO_MAX);
    expect(p.pinned).toEqual({ aa: ['1', '2', '3', '4', '5', '6'] });
    expect(p.hiddenCards).toEqual(['pulls']);
    expect(cleanProfile('garbage')).toEqual(EMPTY_PROFILE);
  });

  it('pins at most 6 per game; unpinning the last removes the game', () => {
    let p = EMPTY_PROFILE;
    for (let i = 0; i < PIN_MAX + 2; i++) p = togglePin(p, 'aa', `c${i}`);
    expect(p.pinned.aa).toHaveLength(PIN_MAX);
    p = togglePin(togglePin(EMPTY_PROFILE, 'aa', 'c1'), 'aa', 'c1');
    expect(p.pinned).toEqual({});
  });

  it('switches cards on and off', () => {
    const off = setCardShown(EMPTY_PROFILE, 'pity', false);
    expect(off.hiddenCards).toEqual(['pity']);
    expect(setCardShown(off, 'pity', true).hiddenCards).toEqual([]);
    expect(isBlank(EMPTY_PROFILE)).toBe(true);
    expect(isBlank(off)).toBe(false);
  });
});

describe('this device', () => {
  it('saves and loads, stamped with the time', () => {
    const saved = saveDeviceProfile({ ...EMPTY_PROFILE, displayName: 'Mira', avatar: 'data:image/jpeg;base64,AAAA' }, 1234);
    expect(saved.updatedAt).toBe(1234);
    expect(loadDeviceProfile()).toEqual(saved);
  });

  it('never throws away unreadable saved text: it is kept under a backup key', () => {
    localStorage.setItem(DEVICE_KEY, '{broken');
    expect(loadDeviceProfile()).toEqual(EMPTY_PROFILE);
    const kept = Object.keys(localStorage).filter((k) => k.startsWith(`${DEVICE_KEY}.unreadable.`));
    expect(kept).toHaveLength(1);
    expect(localStorage.getItem(kept[0] as string)).toBe('{broken');
  });
});

describe('account rows (public.profiles)', () => {
  it('maps a profile to a row and back', () => {
    const p = { ...EMPTY_PROFILE, displayName: 'Mira', bio: 'Hi', avatar: 'u1/avatar.jpg', banner: null, pinned: { aa: ['c1'] }, hiddenCards: ['pulls' as const], updatedAt: Date.parse('2026-10-01T00:00:00Z') };
    const row = toRow(p, 'u1');
    expect(row).toEqual({
      user_id: 'u1',
      display_name: 'Mira',
      bio: 'Hi',
      avatar_path: 'u1/avatar.jpg',
      banner_path: null,
      showcase: {
        pinned: { aa: ['c1'] },
        hidden_cards: ['pulls'],
        look: { title: null, frame: 'none', name_color: 'ink', pinned_badge: null, owner_title: null, owner_style: { badge: 0, frame: null, name: null, frameVariant: 0, nameVariant: 0 }, rewards: { badge: null, frame: null, name: null }, pinned_shelf: [], best_team: null, title_badge: null, fav_game: null, card_background: null, avatar_char: null, banner_char: null },
        featured: [],
        privacy: { card: false, stats: true, badges: true, showcase: true, luck: true, bio: false },
      },
      updated_at: '2026-10-01T00:00:00.000Z',
    });
    expect(fromRow(row)).toEqual(p);
    // The T52 card fields make the round trip too.
    const t52 = {
      ...p,
      title: 'Seer of worlds',
      frame: 'runes' as const,
      nameColor: 'gold' as const,
      pinnedBadge: 'hall' as const,
      ownerStyle: { badge: 3, frame: 16, name: 15, frameVariant: 4, nameVariant: 0 },
      avatarChar: { game: 'aa', id: 'c1' },
      featured: [{ kind: 'team' as const, game: 'aa', id: 't1' }],
      privacy: { card: true, stats: false, badges: true, showcase: true, luck: false, bio: true },
      pinnedShelf: ['hall' as const, 'smith' as const],
      titleBadge: 'hundred' as const,
      favGame: 'aa',
      cardBackground: 'bifrost' as const,
      bestTeam: { game: 'aa', id: 't1' },
    };
    expect(fromRow(toRow(t52, 'u1'))).toEqual(t52);
    expect(fromRow(null)).toEqual(EMPTY_PROFILE);
    expect(fromRow({ user_id: 'u1', display_name: null, bio: null, avatar_path: null, banner_path: null, showcase: null })).toEqual(EMPTY_PROFILE);
  });

  it('keeps the card fields to what the app knows (T52)', () => {
    const p = cleanProfile({
      title: '  A   very long title '.repeat(10),
      frame: 'laser',
      nameColor: 'red',
      pinnedBadge: 'made-up',
      ownerTitle: 'Emperor',
      avatarChar: { game: 'aa', id: '../x' },
      featured: [1, 2, 3, 4, 5].map((n) => ({ kind: 'character', game: 'aa', id: `c${n}` })),
      privacy: { card: 'yes' },
    });
    expect(p.title?.length).toBe(60);
    expect([p.frame, p.nameColor, p.pinnedBadge, p.ownerTitle, p.avatarChar]).toEqual(['none', 'ink', null, null, null]);
    expect(p.featured.map((f) => f.id)).toEqual(['c1', 'c2', 'c3', 'c4']);
    expect(p.privacy.card).toBe(false); // nothing shows to others unless switched on
  });

  it('refuses to put picture data into the row (pictures go to storage first)', () => {
    expect(() => toRow({ ...EMPTY_PROFILE, avatar: 'data:image/jpeg;base64,AAAA' }, 'u1')).toThrow();
  });

  it('pictures live in your own folder of the avatars bucket', () => {
    expect(storagePath('u1', 'avatar')).toBe('u1/avatar.jpg');
    expect(storagePath('u1', 'banner', 'image/png')).toBe('u1/banner.png');
  });

  it('saving uploads new pictures to <user id>/… and writes paths, never picture data, to the row', async () => {
    const upload = vi.fn(async () => ({ error: null }));
    const upsert = vi.fn(async () => ({ error: null }));
    const client = {
      storage: { from: () => ({ upload, getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn/avatars/${path}` } }) }) },
      from: () => ({ upsert }),
    };
    const store = accountStore(client as never, 'u1');
    const saved = await store.save({ ...EMPTY_PROFILE, displayName: 'Mira', avatar: 'data:image/jpeg;base64,AAAA' });
    expect(upload).toHaveBeenCalledWith('u1/avatar.jpg', expect.any(Blob), expect.objectContaining({ upsert: true, contentType: 'image/jpeg' }));
    expect(saved.avatar).toBe('u1/avatar.jpg');
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'u1', display_name: 'Mira', avatar_path: 'u1/avatar.jpg', banner_path: null }));
    expect(store.imageUrl('u1/avatar.jpg', 5)).toBe('https://cdn/avatars/u1/avatar.jpg?v=5');
  });
});

describe('pictures', () => {
  it('accepts PNG/JPG/WebP/GIF up to 2 MB', () => {
    expect(checkImage({ type: 'image/png', size: 1000 })).toBeNull();
    expect(checkImage({ type: 'image/svg+xml', size: 1000 })).toMatch(/isn’t a picture/);
    expect(checkImage({ type: 'image/jpeg', size: 3 * 1024 * 1024 })).toMatch(/3\.0 MB.*2 MB/);
  });

  it('crops from the centre to fill the box', () => {
    expect(coverCrop(1000, 500, 256, 256)).toEqual({ sx: 250, sy: 0, sw: 500, sh: 500 });
    expect(coverCrop(1200, 1200, 1200, 360)).toEqual({ sx: 0, sy: 420, sw: 1200, sh: 360 });
  });
});
