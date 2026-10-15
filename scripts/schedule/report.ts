/**
 * What an automatic refresh changed, in plain words: the run summary (PR text, run log)
 * and the inbox findings. Pure; the git and network parts are in scripts/data-report.ts
 * (tests/dataReport.test.ts).
 *
 * Everything here is already in the built-in lists once the data PR merges, so the
 * findings are all kind "info": approving one never adds a second copy.
 */

export interface Item {
  id: string;
  [k: string]: unknown;
}

export interface Lists {
  characters: Item[];
  banners: Item[];
  events: Item[];
  versions: Item[];
  kits: Item[];
}

export interface Finding {
  job: 'leaks-scan' | 'events-scan' | 'game-data-refresh';
  game_id: string;
  kind: 'info';
  title: string;
  payload: Record<string, unknown>;
  source: { name: string; url?: string };
}

export interface Report {
  lines: string[];
  findings: Finding[];
  /** Characters whose beta kit text changed (LOGIC-CORE re-reads their sheets). */
  kitChanged: string[];
}

const byId = (list: Item[], key = 'id') => new Map(list.map((x) => [String(x[key]), x]));
const nameOf = (x: Item | undefined) => String(x?.name ?? x?.title ?? x?.id ?? '');
const day = (iso: unknown) => (typeof iso === 'string' ? iso.slice(0, 10) : '?');

/** Skill labels whose game text differs, plus added and removed ones. */
export function kitDiff(before: Item | undefined, after: Item): string[] {
  type Skill = { id: string; label?: string; gameText?: string };
  const old = new Map(((before?.skills ?? []) as Skill[]).map((s) => [s.id, s]));
  const now = new Map(((after.skills ?? []) as Skill[]).map((s) => [s.id, s]));
  const out: string[] = [];
  for (const [id, s] of now) {
    const o = old.get(id);
    if (!o) out.push(`new: ${s.label ?? id}`);
    else if ((o.gameText ?? '') !== (s.gameText ?? '') || (o.label ?? '') !== (s.label ?? '')) out.push(`changed: ${s.label ?? id}`);
  }
  for (const [id, o] of old) if (!now.has(id)) out.push(`gone: ${o.label ?? id}`);
  return out;
}

export interface ReportOptions {
  /** nanoka's newest build, named on leak lines (a beta kit names its own build, `kit.version`). */
  build?: string;
  now: number;
  /** Why LOGIC-CORE's kit sheet for this character is stale (their buildLibrary().stale), or undefined. */
  staleSheet?: (characterId: string) => string | undefined;
}

/** Compare one game's lists before and after a refresh. */
export function report(game: string, before: Lists, after: Lists, { build, now, staleSheet = () => undefined }: ReportOptions): Report {
  const lines: string[] = [];
  const findings: Finding[] = [];
  const kitChanged: string[] = [];
  const G = game.toUpperCase();
  const nanoka = { name: `nanoka.cc${build ? `, build ${build}` : ''}`, url: `https://nanoka.cc/${game}` };
  const official =
    game === 'endfield'
      ? { name: 'Official news (Gryphline) + endfield.wiki.gg, CC BY-SA (scripts/import-endfield.ts)', url: 'https://endfield.wiki.gg' }
      : { name: 'Official notices + community wiki (scripts/import-schedule.ts)' };

  // Versions: new ones and moved ends (the next patch day).
  const oldV = byId(before.versions);
  for (const v of after.versions) {
    const o = oldV.get(v.id);
    if (!o) lines.push(`${G}: version ${v.id} added (${day(v.start)} → ${day(v.end)})`);
    else if (o.end !== v.end) lines.push(`${G}: version ${v.id} end ${day(o.end)} → ${day(v.end)}`);
  }
  for (const l of lines) findings.push({ job: 'events-scan', game_id: game, kind: 'info', title: l, payload: {}, source: official });

  // Characters: new, leak flag added (new leak) or removed (officially confirmed), name changed.
  const oldC = byId(before.characters);
  for (const c of after.characters) {
    const o = oldC.get(c.id);
    const leak = Boolean(c.leak);
    let line: string | undefined;
    let job: Finding['job'] = 'game-data-refresh';
    if (!o) {
      line = `${G}: new character ${nameOf(c)}${leak ? ' (leak)' : ''}${c.releasedAt ? `, out ${day(c.releasedAt)}` : ''}`;
      if (leak) job = 'leaks-scan';
    } else if (leak && !o.leak) {
      line = `${G}: ${nameOf(c)} is now a leak`;
      job = 'leaks-scan';
    } else if (!leak && o.leak) {
      line = `${G}: ${nameOf(o)} officially confirmed${nameOf(o) === nameOf(c) ? '' : ` as ${nameOf(c)}`}${c.releasedAt ? `, out ${day(c.releasedAt)}` : ''}`;
      job = 'leaks-scan';
    } else if (nameOf(o) !== nameOf(c)) line = `${G}: ${nameOf(o)} is now called ${nameOf(c)}`;
    else if (o.art !== c.art || o.portrait !== c.portrait) {
      // Pictures alone: a line in the summary, no inbox finding.
      lines.push(`${G}: ${nameOf(c)}: pictures updated`);
      continue;
    }
    if (!line) continue;
    lines.push(line);
    findings.push({ job, game_id: game, kind: 'info', title: line, payload: { id: c.id }, source: job === 'leaks-scan' && leak ? nanoka : official });
  }

  // Banners and events: new ones and changed times.
  for (const [list, what] of [
    ['banners', 'banner'],
    ['events', 'event'],
  ] as const) {
    const old = byId(before[list]);
    const added = after[list].filter((x) => !old.has(x.id));
    const moved = after[list].filter((x) => {
      const o = old.get(x.id);
      return o && (o.start !== x.start || o.end !== x.end);
    });
    for (const x of added) {
      const line = `${G}: new ${what} ${nameOf(x)} (${day(x.start)} → ${day(x.end)})`;
      lines.push(line);
      findings.push({ job: 'events-scan', game_id: game, kind: 'info', title: line, payload: { id: x.id }, source: official });
    }
    for (const x of moved) {
      const o = old.get(x.id);
      lines.push(`${G}: ${what} ${nameOf(x)} times changed (${day(o?.start)} → ${day(o?.end)} is now ${day(x.start)} → ${day(x.end)})`);
    }
  }

  // Beta kits: compared for every leaked or upcoming character on every run.
  const chars = byId(after.characters);
  const oldK = byId(before.kits, 'characterId');
  for (const k of after.kits) {
    const id = String(k.characterId);
    const o = oldK.get(id);
    const c = chars.get(id);
    const upcoming = Boolean(k.beta) || Boolean(c?.leak) || (typeof c?.releasedAt === 'string' && Date.parse(c.releasedAt) > now);
    if (!upcoming) continue;
    const changes = kitDiff(o, k);
    if (!changes.length) continue;
    kitChanged.push(id);
    const stale = staleSheet(id);
    const who = nameOf(c) || id;
    const from = k.beta && typeof k.version === 'string' ? k.version : build;
    const line = `${G}: ${who}: ${o ? 'beta kit changed' : 'beta kit added'}${from ? ` in build ${from}` : ''} (${changes.length} part${changes.length === 1 ? '' : 's'})`;
    lines.push(line);
    for (const ch of changes.slice(0, 12)) lines.push(`  - ${ch}`);
    if (changes.length > 12) lines.push(`  - … ${changes.length - 12} more`);
    if (stale) lines.push(`  - LOGIC-CORE: re-read ${who}'s kit sheet (${stale})`);
    findings.push({
      job: 'leaks-scan',
      game_id: game,
      kind: 'info',
      title: line,
      payload: { characterId: id, ...(from ? { build: from } : {}), changes: changes.slice(0, 40), ...(stale ? { staleSheet: stale, note: 'LOGIC-CORE: re-read this kit sheet' } : {}) },
      source: { ...nanoka, name: `nanoka.cc${from ? `, build ${from}` : ''}` },
    });
  }
  return { lines, findings, kitChanged };
}
