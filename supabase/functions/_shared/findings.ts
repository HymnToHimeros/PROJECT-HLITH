/**
 * The findings inbox (scheduler_findings), server side: checking a delivery from the
 * external routine (findings-intake function, docs/ROUTINES.md) and saving findings
 * without repeats. Pure apart from the small `Db` shape, so it is tested with a fake.
 */
import { EXTERNAL_JOB_IDS } from './jobs.ts';
import { DEDUPE_DAYS, dedupeKey, FINDING_KINDS, freshFindings, type FindingKind, type NewFinding } from './scheduler.ts';

/** The header the routine sends its key in. */
export const INTAKE_HEADER = 'x-intake-key';
/** The Vault secret holding that key. */
export const INTAKE_SECRET = 'findings_intake_key';
export const INTAKE_LIMITS = { bodyBytes: 256_000, findings: 100, title: 300, payloadChars: 8_000, sourceName: 120, url: 1_000 } as const;
/** Keys shorter than this are refused outright (the owner makes a long random one). */
export const MIN_KEY_LENGTH = 32;

const DAY = 86_400_000;

export type Intake = { ok: true; byJob: Map<string, NewFinding[]> } | { ok: false; problems: string[] };

/**
 * Checks a whole delivery: { ran?: [job, …], findings: [{ job, game_id?, kind, title, payload?, source, found_at? }] }.
 * `ran` lists jobs the routine ran this time, so a run that found nothing is still recorded.
 * All or nothing: any problem refuses the whole batch, with every problem listed, so the
 * routine can fix and resend. Nothing is guessed or filled in.
 */
export function readIntake(body: unknown, now: number): Intake {
  const problems: string[] = [];
  const b = body && typeof body === 'object' ? (body as { findings?: unknown; ran?: unknown }) : {};
  const list = b.findings;
  if (!Array.isArray(list)) return { ok: false, problems: ['Send JSON: { "ran": [ … ], "findings": [ … ] }.'] };
  if (list.length > INTAKE_LIMITS.findings) return { ok: false, problems: [`At most ${INTAKE_LIMITS.findings} findings per delivery; send the rest in another.`] };
  const ran = b.ran === undefined ? [] : b.ran;
  if (!Array.isArray(ran) || ran.some((j) => typeof j !== 'string' || !EXTERNAL_JOB_IDS.includes(j))) {
    return { ok: false, problems: [`"ran" must list job ids from: ${EXTERNAL_JOB_IDS.join(', ')}.`] };
  }
  if (list.length === 0 && ran.length === 0) return { ok: false, problems: ['Nothing to deliver: "findings" is empty and "ran" names no job.'] };

  const byJob = new Map<string, NewFinding[]>((ran as string[]).map((j) => [j, []]));
  list.forEach((raw, i) => {
    const at = `findings[${i}]`;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return problems.push(`${at}: not an object.`);
    const r = raw as Record<string, unknown>;
    const job = typeof r.job === 'string' ? r.job : '';
    if (!EXTERNAL_JOB_IDS.includes(job)) problems.push(`${at}.job: must be one of ${EXTERNAL_JOB_IDS.join(', ')}.`);
    if (!FINDING_KINDS.includes(r.kind as FindingKind)) problems.push(`${at}.kind: must be one of ${FINDING_KINDS.join(', ')}.`);
    const title = typeof r.title === 'string' ? r.title.trim() : '';
    if (!title) problems.push(`${at}.title: missing.`);
    else if (title.length > INTAKE_LIMITS.title) problems.push(`${at}.title: longer than ${INTAKE_LIMITS.title} characters.`);
    let gameId: string | null = null;
    if (r.game_id !== undefined && r.game_id !== null) {
      if (typeof r.game_id === 'string' && /^[a-z0-9-]{1,32}$/.test(r.game_id)) gameId = r.game_id;
      else problems.push(`${at}.game_id: lower-case letters, digits and "-" only (e.g. "hsr", "zzz"), or leave it out.`);
    }
    let payload: Record<string, unknown> = {};
    if (r.payload !== undefined) {
      if (!r.payload || typeof r.payload !== 'object' || Array.isArray(r.payload)) problems.push(`${at}.payload: must be an object.`);
      else if (JSON.stringify(r.payload).length > INTAKE_LIMITS.payloadChars) problems.push(`${at}.payload: larger than ${INTAKE_LIMITS.payloadChars} characters.`);
      else payload = r.payload as Record<string, unknown>;
    }
    // Every finding names where it came from (leaks always show their source).
    const src = r.source && typeof r.source === 'object' && !Array.isArray(r.source) ? (r.source as Record<string, unknown>) : null;
    const sourceName = src && typeof src.name === 'string' ? src.name.trim() : '';
    const sourceUrl = src && typeof src.url === 'string' ? src.url.trim() : '';
    if (!sourceName) problems.push(`${at}.source.name: missing (who or what it came from).`);
    else if (sourceName.length > INTAKE_LIMITS.sourceName) problems.push(`${at}.source.name: longer than ${INTAKE_LIMITS.sourceName} characters.`);
    if (sourceUrl && (!/^https?:\/\/\S+$/i.test(sourceUrl) || sourceUrl.length > INTAKE_LIMITS.url)) problems.push(`${at}.source.url: must be an http(s) address.`);
    let foundAt: string | undefined;
    if (r.found_at !== undefined) {
      const t = typeof r.found_at === 'string' ? Date.parse(r.found_at) : NaN;
      if (!Number.isFinite(t)) problems.push(`${at}.found_at: must be an ISO date-time, e.g. "2026-10-09T06:00:00Z".`);
      else if (t > now + 10 * 60_000) problems.push(`${at}.found_at: is in the future.`);
      else if (t < now - 365 * DAY) problems.push(`${at}.found_at: is more than a year ago.`);
      else foundAt = new Date(t).toISOString();
    }
    if (problems.length) return;
    const f: NewFinding = { game_id: gameId, kind: r.kind as FindingKind, title, payload, source_name: sourceName, source_url: sourceUrl || null, ...(foundAt ? { found_at: foundAt } : {}) };
    byJob.set(job, [...(byJob.get(job) ?? []), f]);
  });
  return problems.length ? { ok: false, problems } : { ok: true, byJob };
}

// ── Database ─────────────────────────────────────────────────────────
type Answer = { data: unknown; error: { message: string } | null };
export interface FindingsQuery extends PromiseLike<Answer> {
  select(columns: string): FindingsQuery;
  insert(rows: object[]): FindingsQuery;
  eq(column: string, value: unknown): FindingsQuery;
  in(column: string, values: unknown[]): FindingsQuery;
  gte(column: string, value: string): FindingsQuery;
}
export interface FindingsDb {
  from(table: string): FindingsQuery;
}

/**
 * Adds a job's findings to the inbox as 'new', skipping any the same job delivered in the
 * last DEDUPE_DAYS days (same game, kind, source and title). Never changes or removes a row.
 */
export async function saveFindings(db: FindingsDb, jobId: string, findings: NewFinding[], deliveredBy: 'scheduler' | 'routine', now: number): Promise<{ added: number; known: number }> {
  if (!findings.length) return { added: 0, known: 0 };
  const keys = [...new Set(findings.map(dedupeKey))];
  const since = new Date(now - DEDUPE_DAYS * DAY).toISOString();
  const seen = await db.from('scheduler_findings').select('dedupe_key').eq('job_id', jobId).gte('delivered_at', since).in('dedupe_key', keys);
  if (seen.error) throw new Error(`Reading earlier findings failed: ${seen.error.message}`);
  const known = new Set((Array.isArray(seen.data) ? (seen.data as { dedupe_key: unknown }[]) : []).map((r) => String(r.dedupe_key)));
  const fresh = freshFindings(findings, known);
  if (fresh.length) {
    const deliveredAt = new Date(now).toISOString();
    const rows = fresh.map((f) => ({
      job_id: jobId,
      game_id: f.game_id,
      kind: f.kind,
      title: f.title,
      payload: f.payload,
      source_name: f.source_name,
      source_url: f.source_url,
      dedupe_key: dedupeKey(f),
      found_at: f.found_at ?? deliveredAt,
      delivered_at: deliveredAt,
      delivered_by: deliveredBy,
      status: 'new',
    }));
    const ins = await db.from('scheduler_findings').insert(rows);
    if (ins.error) throw new Error(`Saving findings failed: ${ins.error.message}`);
  }
  return { added: fresh.length, known: findings.length - fresh.length };
}

export interface DeliveryQuery extends FindingsQuery {
  upsert(rows: object[], options?: object): PromiseLike<Answer>;
  update(patch: object): { eq(column: string, value: unknown): PromiseLike<Answer> };
}
export interface DeliveryDb {
  from(table: string): DeliveryQuery;
}

/**
 * Saves one checked delivery from the routine: for each job, adds its new findings,
 * records a run ("Delivered N findings") and stamps the job row with the delivery time.
 */
export async function deliver(
  db: DeliveryDb,
  byJob: Map<string, NewFinding[]>,
  now: number,
  nextDue: (jobId: string, at: number) => string | null,
): Promise<{ job: string; delivered: number; added: number; known: number }[]> {
  const jobs = [...byJob.keys()];
  const reg = await db.from('scheduler_jobs').upsert(
    jobs.map((id) => ({ id })),
    { onConflict: 'id', ignoreDuplicates: true },
  );
  if (reg.error) throw new Error(`Registering jobs failed: ${reg.error.message}`);
  const at = new Date(now).toISOString();
  const out: { job: string; delivered: number; added: number; known: number }[] = [];
  for (const [job, list] of byJob) {
    const { added, known } = await saveFindings(db, job, list, 'routine', now);
    const message = `Delivered ${list.length} finding${list.length === 1 ? '' : 's'}${known ? ` (${known} already known)` : ''}.`;
    const run = await db
      .from('scheduler_runs')
      .insert([{ job_id: job, started_at: at, finished_at: at, status: 'ok', message, counts: { delivered: list.length, added, known }, started_by: 'routine' }]);
    if (run.error) throw new Error(`Recording the delivery failed: ${run.error.message}`);
    const upd = await db.from('scheduler_jobs').update({ last_run_at: at, last_status: 'ok', last_message: message, next_due_at: nextDue(job, now) }).eq('id', job);
    if (upd.error) throw new Error(`Updating ${job} failed: ${upd.error.message}`);
    out.push({ job, delivered: list.length, added, known });
  }
  return out;
}
