/**
 * Is now a time to look for news? (`npm run schedule:due`)
 *
 * Reads only files in the repo (versions, banners, scripts/schedule/rhythm.json)
 * and needs no install, so the scheduled GitHub Action can ask it first and stop at once
 * when nothing is due. Rules: scripts/schedule/rhythm.ts.
 *
 *   node scripts/schedule-due.ts                  due in the last 2 hours? + the next check
 *   node scripts/schedule-due.ts --plan 21        every check of the next 21 days
 *   node scripts/schedule-due.ts --now 2026-10-19T05:30:00Z --window 3h
 *   node scripts/schedule-due.ts --key            the research routine's next key moment
 *
 * Prints `due=true|false` and `next=<ISO>`; in a GitHub Action both also go to $GITHUB_OUTPUT.
 * With --key also `next_key=<ISO>` and the key moments of the next 3 weeks (keyMoments in rhythm.ts).
 */
import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { dueNow, keyMoments, nextCheck, planChecks, type Plan, type SignalLog, type VersionSpan } from './schedule/rhythm.ts';

const ROOT = resolve(import.meta.dirname, '..');
const GAMES = ['hsr', 'zzz'];
const HOUR = 3_600_000;

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const read = <T>(path: string): T => JSON.parse(readFileSync(resolve(ROOT, path), 'utf8')) as T;

const now = arg('now') ? Date.parse(arg('now') ?? '') : Date.now();
const windowMs = Number(/^(\d+(?:\.\d+)?)h$/.exec(arg('window') ?? '2h')?.[1] ?? 2) * HOUR;
const planDays = arg('plan') ? Number(arg('plan')) : undefined;
const key = process.argv.includes('--key');
if (Number.isNaN(now) || Number.isNaN(windowMs)) throw new Error('Bad --now or --window.');

const rhythm = read<Record<string, SignalLog>>('scripts/schedule/rhythm.json');
const plans: Plan[] = GAMES.flatMap((game) => {
  const versions = read<VersionSpan[]>(`src/games/${game}/data/versions.json`);
  // Banner starts inside a version are phase 2: new banners and their notices.
  const starts = read<{ start: string }[]>(`src/games/${game}/data/banners.json`).map((x) => x.start);
  const plan = planChecks(game, versions, rhythm[game] ?? {}, now - windowMs, (planDays ?? 30) + 1, starts);
  return plan ? [plan] : [];
});

if (planDays !== undefined) {
  for (const p of plans) {
    console.log(`${p.game}: version ${p.version}, next patch ${p.nextPatch}${p.nextPatchStated ? '' : ' (estimated)'}`);
    for (const s of p.slots) if (Date.parse(s.at) > now) console.log(`  ${s.at.slice(0, 16).replace('T', ' ')} UTC  ${s.why.join('; ')}`);
  }
}

const due = dueNow(plans, now, windowMs);
const next = nextCheck(plans, now);
console.log(`due=${due.length > 0}`);
for (const d of due) console.log(`  ${d.game} ${d.slot.at}: ${d.slot.why.join('; ')}`);
console.log(`next=${next?.slot.at ?? ''}`);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `due=${due.length > 0}\nnext=${next?.slot.at ?? ''}\ngames=${[...new Set(due.map((d) => d.game))].join(',')}\n`);

if (key) {
  const moments = keyMoments(plans, now).filter((k) => Date.parse(k.at) < now + 21 * 24 * HOUR);
  for (const k of moments) console.log(`  key ${k.at.slice(0, 16).replace('T', ' ')} UTC  ${k.why.join('; ')}`);
  console.log(`next_key=${moments[0]?.at ?? ''}`);
}
