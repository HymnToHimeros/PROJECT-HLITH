/**
 * Server functions check the caller themselves: a signed-in HLITH user, proven by
 * asking Supabase Auth about the access token. (The platform's verify_jwt switch
 * does not stop callers that send only the public key, so we never rely on it.)
 *
 * A banned account is refused too (T60b), even with a session from before the ban: Auth's
 * own ban (banned_until on the user) and HLITH's (public.is_banned(), asked as the caller).
 * Only Export my data lets a banned account through (allowBanned), to download its own data.
 */
type Fetch = (
  url: string,
  init: { method?: string; headers: Record<string, string>; body?: string },
) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

export async function requireUser(
  authorization: string | null,
  env: { url: string | undefined; key: string | undefined },
  fetchFn: Fetch,
  opts: { now?: number; allowBanned?: boolean } = {},
): Promise<{ ok: true; userId: string; banned?: true } | { ok: false; banned?: true }> {
  const now = opts.now ?? Date.now();
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  // A real user token is a JWT (three dot-separated parts); the public key is not.
  if (!token || token.split('.').length !== 3 || !env.url || !env.key) return { ok: false };
  try {
    const headers = { apikey: env.key, Authorization: `Bearer ${token}` };
    const res = await fetchFn(`${env.url}/auth/v1/user`, { headers });
    if (!res.ok) return { ok: false };
    const user = (await res.json()) as { id?: unknown; role?: unknown; banned_until?: unknown };
    if (typeof user.id !== 'string' || user.role !== 'authenticated') return { ok: false };
    const banned = async () => {
      if (typeof user.banned_until === 'string' && Date.parse(user.banned_until) > now) return true;
      const ban = await fetchFn(`${env.url}/rest/v1/rpc/is_banned`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: '{}' });
      return ban.ok && (await ban.json()) === true;
    };
    if (await banned()) return opts.allowBanned ? { ok: true, userId: user.id, banned: true } : { ok: false, banned: true };
    return { ok: true, userId: user.id };
  } catch {
    return { ok: false };
  }
}
