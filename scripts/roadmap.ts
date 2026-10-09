// Ticks docs/ROADMAP.md from the proof files on disk. Run: npm run roadmap
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse, problems, update } from './roadmap-lib.ts';

const root = resolve(import.meta.dirname, '..');
const file = resolve(root, 'docs/ROADMAP.md');
const before = readFileSync(file, 'utf8');
const issues = problems(parse(before));
if (issues.length) {
  console.error(issues.join('\n'));
  process.exit(1);
}
const after = update(before, (p) => existsSync(resolve(root, p)));
writeFileSync(file, after);
const items = parse(after);
console.log(`ROADMAP: ${items.filter((i) => i.checked).length} of ${items.length} done${after === before ? ' (no change)' : ' (updated)'}`);
