/**
 * After an automatic refresh: what changed, compared with the last commit (`git show HEAD:…`).
 * Used by .github/workflows/data-refresh.yml; rules in scripts/schedule/report.ts.
 *
 *   node scripts/data-report.ts --summary out.md --intake intake.json [--next ISO] [--failed "job: message"]…
 *
 * --summary  plain-words summary (PR text and run log)
 * --intake   the findings-intake request body (docs/ROUTINES.md): ran, failed, next_at, findings
 * Prints the summary and `changed=N` (lines).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { report, type Finding, type Item, type Lists } from './schedule/report.ts';

const ROOT = resolve(import.meta.dirname, '..');
/** Every game with lists (Endfield once its data folder exists). */
const GAMES = ['hsr', 'zzz', 'endfield', 'genshin'].filter((g) => existsSync(resolve(ROOT, `src/games/${g}/data/versions.json`)));
const JOBS = ['leaks-scan', 'events-scan', 'game-data-refresh'] as const;
const LISTS = ['characters', 'banners', 'events', 'versions', 'kits'] as const;

const args = process.argv.slice(2);
const arg = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const all = (name: string) => args.flatMap((a, i) => (a === `--${name}` && args[i + 1] ? [args[i + 1] ?? ''] : []));

function atHead(path: string): Item[] {
  try {
    return JSON.parse(execFileSync('git', ['show', `HEAD:${path}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 })) as Item[];
  } catch {
    return [];
  }
}
const now = (path: string): Item[] => (existsSync(resolve(ROOT, path)) ? (JSON.parse(readFileSync(resolve(ROOT, path), 'utf8')) as Item[]) : []);

let builds: Record<string, string | undefined> = {};
try {
  const res = await fetch('https://static.nanoka.cc/manifest.json', { headers: { 'user-agent': 'PROJECT-HLITH data report' } });
  const m = (await res.json()) as Record<string, { latest?: string; live?: string }>;
  builds = Object.fromEntries(GAMES.map((g) => [g, m[g]?.latest]));
} catch {
  // Build numbers are only named in the summary; leave them out when nanoka does not answer.
}

/**
 * Why LOGIC-CORE's kit sheet for a character is stale: their `buildLibrary().stale`
 * (src/games/<game>/kitcheck/library.ts), loaded through Vite because app code imports
 * JSON and leaves out file endings. It reads kits.json as it is now, after the import.
 */
async function staleSheets(): Promise<Record<string, (id: string) => string | undefined>> {
  const out: Record<string, (id: string) => string | undefined> = {};
  const { createServer } = await import('vite');
  const vite = await createServer({ configFile: false, root: ROOT, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] } });
  try {
    for (const game of GAMES) {
      // A game without kit sheets (Endfield for now) has nothing that can be stale.
      if (!existsSync(resolve(ROOT, `src/games/${game}/kitcheck/library.ts`))) continue;
      const lib = ((await vite.ssrLoadModule(`/src/games/${game}/kitcheck/library.ts`)) as { buildLibrary: () => { stale?: Map<string, string> } }).buildLibrary();
      // No `stale` means no sheet is stale.
      const stale = lib.stale ?? new Map<string, string>();
      out[game] = (id) => stale.get(id);
    }
  } catch (e) {
    console.warn(`Kit sheets not checked: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    await vite.close();
  }
  return out;
}
const stale = await staleSheets();

const lines: string[] = [];
const findings: Finding[] = [];
for (const game of GAMES) {
  const path = (l: string) => `src/games/${game}/data/${l}.json`;
  const before = Object.fromEntries(LISTS.map((l) => [l, atHead(path(l))])) as unknown as Lists;
  const after = Object.fromEntries(LISTS.map((l) => [l, now(path(l))])) as unknown as Lists;
  const r = report(game, before, after, { build: builds[game], now: Date.now(), ...(stale[game] ? { staleSheet: stale[game] } : {}) });
  lines.push(...r.lines);
  findings.push(...r.findings);
}

const failed = all('failed').map((f) => {
  const [job = '', ...rest] = f.split(':');
  return { job: job.trim(), message: rest.join(':').trim().slice(0, 500) };
});
const failedJobs = new Set(failed.map((f) => f.job));
const next = arg('next');
const intake = {
  ran: JOBS.filter((j) => !failedJobs.has(j)),
  ...(failed.length ? { failed } : {}),
  ...(next && Date.parse(next) > Date.now() ? { next_at: Object.fromEntries(JOBS.map((j) => [j, next])) } : {}),
  // One outcome per job per delivery: a failed job sends no findings.
  findings: findings.filter((f) => !failedJobs.has(f.job)).slice(0, 100),
};

const summary = lines.length ? lines.map((l) => (l.startsWith('  ') ? `  ${l.trim()}` : `- ${l}`)).join('\n') : '- No changes.';
const out = arg('summary');
if (out) writeFileSync(out, `${summary}\n`);
const intakeOut = arg('intake');
if (intakeOut) writeFileSync(intakeOut, JSON.stringify(intake));
console.log(summary);
console.log(`changed=${lines.length}`);
