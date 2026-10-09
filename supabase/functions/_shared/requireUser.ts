/**
 * Server functions check the caller themselves: a signed-in HLITH user, proven by
 * asking Supabase Auth about the access token. (The platform's verify_jwt switch
 * does not stop callers that send only the public key, so we never rely on it.)
 */
type Fetch = (url: string, init: { headers: Record<string, string> }) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

export async function requireUser(
  authorization: string | null,
  env: { url: string | undefined; key: string | undefined },
  fetchFn: Fetch,
): Promise<{ ok: true; userId: string } | { ok: false }> {
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  // A real user token is a JWT (three dot-separated parts); the public key is not.
  if (!token || token.split('.').length !== 3 || !env.url || !env.key) return { ok: false };
  try {
    const res = await fetchFn(`${env.url}/auth/v1/user`, { headers: { apikey: env.key, Authorization: `Bearer ${token}` } });
    if (!res.ok) return { ok: false };
    const user = (await res.json()) as { id?: unknown; role?: unknown };
    return typeof user.id === 'string' && user.role === 'authenticated' ? { ok: true, userId: user.id } : { ok: false };
  } catch {
    return { ok: false };
  }
}
