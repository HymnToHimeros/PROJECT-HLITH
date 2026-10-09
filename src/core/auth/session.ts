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

/**
 * How this session signed in. Supabase's app_metadata.provider is the FIRST
 * provider ever used and never changes, so use the identity signed in most recently.
 */
export function currentProvider(user: { app_metadata?: { provider?: unknown }; identities?: { provider: string; last_sign_in_at?: string | null }[] | null }): string | undefined {
  const latest = [...(user.identities ?? [])].sort((a, b) => (b.last_sign_in_at ?? '').localeCompare(a.last_sign_in_at ?? ''))[0];
  if (latest) return latest.provider;
  return typeof user.app_metadata?.provider === 'string' ? user.app_metadata.provider : undefined;
}
