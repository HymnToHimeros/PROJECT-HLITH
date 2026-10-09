import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

export type Provider = 'google' | 'discord';

/** Current sign-in. `undefined` while checking, `null` when signed out. */
export function useSession(client: SupabaseClient | null): Session | null | undefined {
  const [session, setSession] = useState<Session | null | undefined>(client ? undefined : null);
  useEffect(() => {
    if (!client) return;
    let alive = true;
    void client.auth.getSession().then(({ data }) => alive && setSession(data.session));
    const { data } = client.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, [client]);
  return session;
}

export async function signInWith(client: SupabaseClient, provider: Provider): Promise<string | null> {
  const { error } = await client.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } });
  return error?.message ?? null;
}

export async function sendEmailLink(client: SupabaseClient, email: string): Promise<string | null> {
  const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
  return error?.message ?? null;
}

export async function signOut(client: SupabaseClient): Promise<void> {
  await client.auth.signOut();
}
