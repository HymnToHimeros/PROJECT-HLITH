import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEVICE_KEY, EMPTY_PROFILE } from './profile';
import { deviceStore, useProfile } from './useProfile';
import { useShellIdentity } from './useShellIdentity';

beforeEach(() => localStorage.clear());

describe('the sidebar profile card’s data', () => {
  it('is null while loading, then shows the saved name, picture and banner', async () => {
    localStorage.setItem(DEVICE_KEY, JSON.stringify({ displayName: 'Mira', avatar: 'data:image/png;base64,AA', banner: 'data:image/jpeg;base64,BB', updatedAt: 1 }));
    const { result } = renderHook(() => useShellIdentity(null));
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current).toEqual({ name: 'Mira', avatarUrl: 'data:image/png;base64,AA', bannerUrl: 'data:image/jpeg;base64,BB' });
  });

  it('with nothing saved: no name, no picture, no banner (the card falls back to initials and the theme glow)', async () => {
    const { result } = renderHook(() => useShellIdentity(null));
    await waitFor(() => expect(result.current).toEqual({ name: null, avatarUrl: null, bannerUrl: null }));
  });

  it('updates as soon as the profile is saved on the Account page (another copy of the profile)', async () => {
    const card = renderHook(() => useShellIdentity(null));
    const page = renderHook(() => useProfile(deviceStore));
    await waitFor(() => expect(card.result.current).not.toBeNull());
    await waitFor(() => expect(page.result.current.loading).toBe(false));
    await act(async () => {
      await page.result.current.save({ ...EMPTY_PROFILE, displayName: 'Rook', avatar: 'data:image/png;base64,CC' });
    });
    expect(card.result.current).toMatchObject({ name: 'Rook', avatarUrl: 'data:image/png;base64,CC', bannerUrl: null });
  });
});
