/**
 * Server functions check the caller themselves: a signed-in HLITH user, proven by
 * asking Supabase Auth about the access token. (The platform's verify_jwt switch
 * does not stop callers that send only the public key, so we never rely on it.)
 *
 * A banned account is refused too (T60b), even with a session from before the ban: Auth's
 * own ban (banned_until on the user) and HLITH's (public.is_banned(), asked as the caller).
 */
type Fetch = (
  url: string,
  init: { method?: string; headers: Record<string, string>; body?: string },
) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

export async function requireUser(
  authorization: string | null,
  env: { url: string | undefined; key: string | undefined },
  fetchFn: Fetch,
  now = Date.now(),
): Promise<{ ok: true; userId: string } | { ok: false; banned?: true }> {
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  // A real user token is a JWT (three dot-separated parts); the public key is not.
  if (!token || token.split('.').length !== 3 || !env.url || !env.key) return { ok: false };
  try {
    const headers = { apikey: env.key, Authorization: `Bearer ${token}` };
    const res = await fetchFn(`${env.url}/auth/v1/user`, { headers });
    if (!res.ok) return { ok: false };
    const user = (await res.json()) as { id?: unknown; role?: unknown; banned_until?: unknown };
    if (typeof user.id !== 'string' || user.role !== 'authenticated') return { ok: false };
    if (typeof user.banned_until === 'string' && Date.parse(user.banned_until) > now) return { ok: false, banned: true };
    const ban = await fetchFn(`${env.url}/rest/v1/rpc/is_banned`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: '{}' });
    if (ban.ok && (await ban.json()) === true) return { ok: false, banned: true };
    return { ok: true, userId: user.id };
  } catch {
    return { ok: false };
  }
}
