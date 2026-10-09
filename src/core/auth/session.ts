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

/** What the shell shows about a sign-in: the method used for this session, and every method linked to the account. */
export interface SignInInfo {
  /** The method used most recently (this sign-in): the identity with the newest last_sign_in_at. */
  provider: string | undefined;
  /** Every linked method ('discord', 'google', 'email'…). */
  methods: string[];
}

/**
 * Supabase's app_metadata.provider is the FIRST method ever used and never changes, so
 * it can't say how you signed in today. The identities list carries each method's
 * last_sign_in_at; the newest one is this sign-in. app_metadata.providers lists them all.
 */
export function signInInfo(user: Pick<Session['user'], 'identities' | 'app_metadata'>): SignInInfo {
  const identities = user.identities ?? [];
  const time = (t: string | undefined) => (t ? Date.parse(t) || 0 : 0);
  const newest = [...identities].sort((a, b) => time(b.last_sign_in_at) - time(a.last_sign_in_at))[0];
  const listed = Array.isArray(user.app_metadata.providers) ? (user.app_metadata.providers as unknown[]).filter((p): p is string => typeof p === 'string') : [];
  const first = typeof user.app_metadata.provider === 'string' ? user.app_metadata.provider : undefined;
  const methods = [...new Set([...listed, ...identities.map((i) => i.provider), ...(first ? [first] : [])])];
  return { provider: newest?.provider ?? first, methods };
}
