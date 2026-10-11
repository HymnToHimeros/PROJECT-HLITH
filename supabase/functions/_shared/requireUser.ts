/**
 * Server functions check the caller themselves: a signed-in HLITH user, proven by
 * asking Supabase Auth about the access token. (The platform's verify_jwt switch
 * does not stop callers that send only the public key, so we never rely on it.)
 *
 * A banned account is refused too (T60b), even with a session from before the ban: Auth's
 * own ban (banned_until on the user) and HLITH's (public.is_banned(), asked as the caller).
 * Only Export my data lets a banned account through (allowBanned), to download its own data.
 *
 * And an account must have finished the first-run steps (T62: accepted the current Terms and
 * Privacy policy, chosen a username). Only Export my data and Delete my account let it through
 * before that (allowUnaccepted): people must be able to say no.
 */
type Fetch = (
  url: string,
  init: { method?: string; headers: Record<string, string>; body?: string },
) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

export async function requireUser(
  authorization: string | null,
  env: { url: string | undefined; key: string | undefined },
  fetchFn: Fetch,
  opts: { now?: number; allowBanned?: boolean; allowUnaccepted?: boolean } = {},
): Promise<{ ok: true; userId: string; banned?: true } | { ok: false; banned?: true; unaccepted?: true }> {
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
    // Where the account stands, asked as the caller (public.my_gate). An older server without it
    // answers with an error: then only Auth's own ban counts.
    const res2 = await fetchFn(`${env.url}/rest/v1/rpc/my_gate`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: '{}' });
    const gate = res2.ok ? ((await res2.json()) as { banned?: unknown; accepted?: unknown } | null) : null;
    const banned = (typeof user.banned_until === 'string' && Date.parse(user.banned_until) > now) || gate?.banned === true;
    if (banned && !opts.allowBanned) return { ok: false, banned: true };
    if (gate && gate.accepted === false && !opts.allowUnaccepted) return { ok: false, unaccepted: true };
    return banned ? { ok: true, userId: user.id, banned: true } : { ok: true, userId: user.id };
  } catch {
    return { ok: false };
  }
}
