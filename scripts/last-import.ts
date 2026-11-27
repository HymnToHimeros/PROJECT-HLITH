/**
 * When did the data refresh last import everything? (`.github/workflows/data-refresh.yml`, "When did the last import run?")
 *
 * A run counts only when EVERY import step succeeded. The import steps carry on after an error
 * (continue-on-error), so GitHub reports them as "success" either way; the workflow therefore adds
 * a marker step, "All imports succeeded", that runs only when each import's outcome was success.
 * A run whose marker step did not run (skipped) keeps its failed import due, and the next timer run retries it.
 *
 *   GH_TOKEN=… GITHUB_REPOSITORY=owner/repo node scripts/last-import.ts
 *
 * Prints `since=<ISO>` (empty when unknown) and appends it to $GITHUB_OUTPUT. Never fails:
 * no answer means schedule-due.ts falls back to its time window.
 */
import { appendFileSync } from 'node:fs';

/** The marker step's name in data-refresh.yml. */
export const MARKER = 'All imports succeeded';

export interface RunSteps {
  /** The run's start (run_started_at). */
  startedAt: string;
  steps: { name: string; conclusion: string | null }[];
}

/** The start of the newest run (runs newest first) in which the marker step succeeded; undefined if none. */
export function lastFullImport(runs: RunSteps[], marker = MARKER): string | undefined {
  return runs.find((r) => r.steps.some((s) => s.name === marker && s.conclusion === 'success'))?.startedAt;
}

async function main() {
  const repo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GH_TOKEN;
  let since: string | undefined;
  try {
    if (!repo || !token) throw new Error('GITHUB_REPOSITORY or GH_TOKEN not set');
    const api = async <T>(path: string): Promise<T> => {
      const res = await fetch(`https://api.github.com/repos/${repo}/${path}`, { headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json' } });
      if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
      return (await res.json()) as T;
    };
    const { workflow_runs } = await api<{ workflow_runs: { id: number; run_started_at: string }[] }>('actions/workflows/data-refresh.yml/runs?status=completed&per_page=30');
    // Newest first; stop at the first run that imported everything.
    for (const run of workflow_runs) {
      const { jobs } = await api<{ jobs: { steps?: { name: string; conclusion: string | null }[] }[] }>(`actions/runs/${run.id}/jobs`);
      since = lastFullImport([{ startedAt: run.run_started_at, steps: jobs.flatMap((j) => j.steps ?? []) }]);
      if (since) break;
    }
  } catch (e) {
    console.log(`Lookup failed (${(e as Error).message}); the time window rule is used.`);
  }
  console.log(`Last full import started: ${since ?? 'unknown'}`);
  console.log(`since=${since ?? ''}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `since=${since ?? ''}\n`);
}

if (import.meta.main ?? process.argv[1]?.endsWith('last-import.ts')) await main();
