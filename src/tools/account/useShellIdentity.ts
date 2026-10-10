import { useMemo } from 'react';
import type { PanelAccount, ShellIdentity } from '../../core/registry';
import { storeFor, useProfile } from './useProfile';

/**
 * The sidebar's profile card (attached to the shell by main.tsx with registerIdentity):
 * your picture, banner and name from Account → Profile. Updates when you save the profile.
 * null while the profile is still loading, so the card never flashes a wrong picture.
 */
export function useShellIdentity(account: PanelAccount | null): ShellIdentity | null {
  const store = useMemo(() => storeFor(account?.id), [account?.id]);
  const { profile, loading, imageUrl } = useProfile(store);
  if (loading) return null;
  return { name: profile.displayName, avatarUrl: imageUrl(profile.avatar), bannerUrl: imageUrl(profile.banner) };
}
