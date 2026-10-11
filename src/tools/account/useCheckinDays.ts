import { useEffect, useState } from 'react';
import { backend } from '../../core/data/backend';

/**
 * Days with a real check-in (claimed, or already claimed that day) from your HoYoLAB link's
 * records (public.hoyolab_checkins, your own rows only), for the Thirty Dawns badge.
 * null = no server, not signed in, or the records couldn't be read: the badge stays "Not yet".
 */
export function useCheckinDays(userId: string | undefined): string[] | null {
  const [days, setDays] = useState<{ userId: string; days: string[] } | null>(null);
  useEffect(() => {
    if (!backend || !userId) return;
    let alive = true;
    void backend
      .from('hoyolab_checkins')
      .select('ran_at')
      .in('status', ['claimed', 'already'])
      .order('ran_at', { ascending: false })
      .limit(400)
      .then(({ data, error }) => {
        if (!alive || error || !data) return;
        setDays({ userId, days: (data as { ran_at: string }[]).map((r) => r.ran_at.slice(0, 10)) });
      });
    return () => {
      alive = false;
    };
  }, [userId]);
  return days && days.userId === userId ? days.days : null;
}
