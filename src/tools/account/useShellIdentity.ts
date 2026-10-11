import { useEffect, useMemo, useState } from 'react';
import type { Character } from '../../core/contract';
import { listGames, type PanelAccount, type ShellIdentity } from '../../core/registry';
import type { CharRef } from './profile';
import { storeFor, useProfile } from './useProfile';

/** A character chosen as picture or banner (T52), once its game's list has loaded. */
function useCharacterArt(ref: CharRef | null, kind: 'portrait' | 'art'): string | null | undefined {
  const [found, setFound] = useState<{ key: string; url: string | null } | null>(null);
  const key = ref ? `${ref.game}:${ref.id}:${kind}` : '';
  useEffect(() => {
    if (!ref) return;
    const game = listGames().find((g) => g.id === ref.game);
    if (!game) return;
    let alive = true;
    void game.data
      .characters()
      .catch(() => [] as Character[])
      .then((list) => {
        const c = list.find((x) => x.id === ref.id);
        if (alive) setFound({ key, url: (kind === 'art' ? (c?.art ?? c?.portrait) : c?.portrait) ?? null });
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key covers ref and kind
  }, [key]);
  // A game that isn't registered (any more) has no art to wait for.
  if (!ref || !listGames().some((g) => g.id === ref.game)) return null;
  return found?.key === key ? found.url : undefined;
}

/**
 * The sidebar's profile card (attached to the shell by main.tsx with registerIdentity):
 * your picture, banner and name from Account → Profile. Updates when you save the profile.
 * null while the profile is still loading, so the card never flashes a wrong picture.
 */
export function useShellIdentity(account: PanelAccount | null): ShellIdentity | null {
  const store = useMemo(() => storeFor(account?.id), [account?.id]);
  const { profile, loading, imageUrl } = useProfile(store);
  const avatarArt = useCharacterArt(profile.avatarChar, 'portrait');
  const bannerArt = useCharacterArt(profile.bannerChar, 'art');
  if (loading || avatarArt === undefined || bannerArt === undefined) return null;
  return { name: profile.displayName, avatarUrl: avatarArt ?? imageUrl(profile.avatar), bannerUrl: bannerArt ?? imageUrl(profile.banner) };
}
