/**
 * The self-checking roadmap (docs/ROADMAP.md).
 *
 * Each item names one or more proof files. An item is done when every proof
 * file exists, and only then. `npm run roadmap` ticks the boxes and rewrites
 * the summary; tests/roadmap.test.ts fails the build if the file is stale.
 *
 * Item line format:
 *   - [x] R12 Game template · proof: `src/games/_template/contract.ts`
 */
export interface Item {
  id: string;
  title: string;
  proofs: string[];
  checked: boolean;
  phase: string;
  line: number;
}

const ITEM = /^- \[( |x)\] (R\d{2,3}) (.+?) · proof: (.+)$/;
const PHASE = /^## (.+)$/;
const PROOF = /`([^`]+)`/g;
export const SUMMARY_START = '<!-- roadmap:summary -->';
export const SUMMARY_END = '<!-- /roadmap:summary -->';

export function parse(text: string): Item[] {
  const items: Item[] = [];
  let phase = '';
  text.split('\n').forEach((raw, line) => {
    const p = PHASE.exec(raw);
    if (p?.[1]) phase = p[1];
    const m = ITEM.exec(raw);
    if (!m) return;
    const [, box, id, title, proofText] = m as unknown as [string, string, string, string, string];
    items.push({
      id,
      title,
      proofs: [...proofText.matchAll(PROOF)].map((x) => x[1] ?? ''),
      checked: box === 'x',
      phase,
      line,
    });
  });
  return items;
}

export function problems(items: Item[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) out.push(`${item.id} is listed twice`);
    seen.add(item.id);
    if (item.proofs.length === 0) out.push(`${item.id} has no proof file`);
  }
  return out;
}

const bar = (done: number, total: number, width = 20): string => {
  const filled = total === 0 ? 0 : Math.round((done / total) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
};

export function summary(items: Item[]): string {
  const done = items.filter((i) => i.checked).length;
  const phases = [...new Set(items.map((i) => i.phase))];
  const next = items.find((i) => !i.checked);
  const rows = phases.map((phase) => {
    const inPhase = items.filter((i) => i.phase === phase);
    const d = inPhase.filter((i) => i.checked).length;
    return `| ${phase} | \`${bar(d, inPhase.length, 10)}\` | ${d} / ${inPhase.length} |`;
  });
  return [
    SUMMARY_START,
    `**${done} of ${items.length} done** \`${bar(done, items.length)}\` ${Math.round((done / Math.max(items.length, 1)) * 100)}%`,
    '',
    next ? `**Next up:** ${next.id} ${next.title}` : '**Everything on the roadmap is done.**',
    '',
    '| Phase | Progress | Done |',
    '|---|---|---|',
    ...rows,
    SUMMARY_END,
  ].join('\n');
}

/** Tick each item whose proofs all exist, untick the rest, refresh the summary. */
export function update(text: string, exists: (path: string) => boolean): string {
  const lines = text.split('\n');
  for (const item of parse(text)) {
    const done = item.proofs.every(exists);
    lines[item.line] = (lines[item.line] ?? '').replace(/^- \[( |x)\]/, done ? '- [x]' : '- [ ]');
  }
  const ticked = lines.join('\n');
  const start = ticked.indexOf(SUMMARY_START);
  const end = ticked.indexOf(SUMMARY_END);
  if (start === -1 || end === -1) throw new Error('ROADMAP.md is missing its summary markers');
  return ticked.slice(0, start) + summary(parse(ticked)) + ticked.slice(end + SUMMARY_END.length);
}
