// Supabase Edge Function: one Assistant chat turn (ROADMAP R48).
// Signed-in users only (checked here with requireUser). The caller's own Claude
// API key comes with each request, is used for this one call to the Claude
// Messages API, and is never stored, logged or returned.
// Returns the assistant turn plus token usage; the app works out the cost.
import Anthropic from '@anthropic-ai/sdk';
import { checkRequest, errorText, runTurn } from '../_shared/assistant.ts';
import { requireUser } from '../_shared/requireUser.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const user = await requireUser(
    req.headers.get('Authorization'),
    { url: Deno.env.get('SUPABASE_URL'), key: Deno.env.get('SUPABASE_ANON_KEY') },
    (url, init) => fetch(url, init),
  );
  if (!user.ok) return json({ error: 'Sign in to use the Assistant.' }, 401);

  let raw: string;
  let body: unknown;
  try {
    raw = await req.text();
    body = JSON.parse(raw);
  } catch {
    return json({ error: 'Send JSON.' }, 400);
  }
  const checked = checkRequest(body, raw.length);
  if (!checked.ok) return json({ error: checked.error }, 400);

  try {
    const reply = await runTurn(checked.value, (params, apiKey) => new Anthropic({ apiKey, maxRetries: 1 }).beta.messages.create(params));
    return json(reply);
  } catch (err) {
    // Only the status is used: error bodies are not passed on or logged.
    const status = err instanceof Anthropic.APIError ? err.status : undefined;
    const { status: code, error } = errorText(status);
    return json({ error }, code);
  }
});
