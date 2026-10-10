/**
 * Pure helpers for reading HoYoverse notices (in-game notice board and the
 * official websites). No network here, so everything is unit-tested
 * (tests/scheduleText.test.ts).
 *
 * Times: every value becomes an absolute ISO time.
 * - "(UTC+8)" and <t class="t_gl"> are global times in UTC+8.
 * - "(server time)" and <t class="t_lc"> are the player's server clock. The app
 *   stores one time per item, so these use the Asia server (UTC+8): the
 *   earliest of all servers, so nobody is told something is still open after
 *   it closed. America and Europe get the same moment in their own clock later.
 *   (Note for FRAME in docs/PROGRESS.md.)
 * - "After the Version X update" is the update start plus the stated
 *   maintenance length; "End of Version X" is the version end.
 */

export const SERVER_OFFSET = 8;

/** Notice HTML → plain text. Time tags become "⟨gl 2026/11/11 03:59:00⟩" so the zone survives. */
export function noticeText(html: string): string {
  return decode(
    html
      .replace(/<t\s+class="t_(gl|lc)"[^>]*>(.*?)<\/t>/gs, (_m, kind: string, t: string) => `⟨${kind} ${t.replace(/<[^>]+>/g, '')}⟩`)
      .replace(/<br\s*\/?>|<\/p>|<\/div>|<\/tr>|<\/h\d>|<\/li>/g, '\n')
      .replace(/<\/t[dh]>/g, ' | ')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function decode(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_m, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&');
}

/** "2026/11/11 03:59[:00]" at a UTC offset → ISO string in UTC. */
export function at(stamp: string, offsetHours: number): string {
  const m = /(\d{4})[/-](\d{1,2})[/-](\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(stamp);
  if (!m) throw new Error(`Not a date: "${stamp}"`);
  const [, y, mo, d, h, mi, s] = m;
  const ms = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h) - offsetHours, Number(mi), Number(s ?? 0));
  return new Date(ms).toISOString();
}

export interface VersionTimes {
  id: string;
  start: string;
  /** When the update's maintenance ends ("after the update"). */
  open: string;
  end?: string;
}

export interface Span {
  start: string;
  end: string;
}

const STAMP = String.raw`\d{4}/\d{1,2}/\d{1,2}\s+\d{1,2}:\d{2}(?::\d{2})?`;
const ONE = new RegExp(
  String.raw`⟨(gl|lc) (${STAMP})⟩|(${STAMP})\s*\((UTC\+8|server time)\)|after the Version ([\d.]+) update|End of Version ([\d.]+)`,
  'gi',
);

/** Every time in a line, in order, read with the rules above. */
export function timesIn(line: string, versions: Map<string, VersionTimes>): string[] {
  const out: string[] = [];
  for (const m of line.matchAll(ONE)) {
    if (m[1] && m[2]) out.push(at(m[2], SERVER_OFFSET));
    else if (m[3]) out.push(at(m[3], SERVER_OFFSET));
    else if (m[5]) {
      const v = versions.get(m[5]);
      if (!v) throw new Error(`"After the Version ${m[5]} update" but version ${m[5]} is unknown`);
      out.push(v.open);
    } else if (m[6]) {
      const v = versions.get(m[6]);
      if (!v?.end) throw new Error(`"End of Version ${m[6]}" but its end is unknown`);
      out.push(v.end);
    }
  }
  return out;
}

/** A "start – end" period in a line, or undefined when the line has no full period. */
export function spanIn(line: string, versions: Map<string, VersionTimes>): Span | undefined {
  const t = timesIn(line, versions);
  if (t.length < 2) return undefined;
  return { start: t[0]!, end: t[1]! };
}

/** "Stellar Jade ×500" → 500 (all mentions added up). */
export function amountOf(text: string, item: string): number {
  let total = 0;
  for (const m of text.matchAll(new RegExp(String.raw`${item}s?\s*[×x*]\s*([\d,]+)`, 'gi'))) total += Number(m[1]!.replace(/,/g, ''));
  return total;
}

/** Stable id part: lower-case words joined by "-". */
export function slug(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[™®©"'“”‘’!?.,:;()[\]]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Character or weapon name as written in notices, without "(Elation: Ice)" etc. */
export function bareName(s: string): string {
  return s
    .replace(/\s*\([^)]*\)\s*$/, '')
    .replace(/^["“]|["”]$/g, '')
    .trim();
}

/** Name matching that ignores case, quotes, spacing and dots between words ("Himeko • Nova"). */
export function nameKey(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

/** Start of the version from its update notice: "Begins at 2026/09/28 06:00 (UTC+8)" or "[Update Start Time] 2026/09/09 06:00 (UTC+8)". */
export function versionFromNotice(id: string, text: string): VersionTimes | undefined {
  const start =
    new RegExp(String.raw`(?:Update Time|Update Start Time)[\s\S]{0,40}?(${STAMP})\s*\(UTC\+8\)`, 'i').exec(text)?.[1] ??
    new RegExp(String.raw`(?:begins? at|starting at|start(?:s|ing)? at)\s*(${STAMP})\s*\(UTC\+8\)`, 'i').exec(text)?.[1];
  if (!start) return undefined;
  const hours = /take (?:approximately|about) (\d+|five|four|six) hours?/i.exec(text)?.[1];
  const words: Record<string, number> = { four: 4, five: 5, six: 6 };
  const h = hours === undefined ? 5 : (words[hours.toLowerCase()] ?? Number(hours));
  const startIso = at(start, 8);
  const end =
    new RegExp(String.raw`Version ${id.replace('.', '\\.')} will run[^\n]*?(?:until|ending on)\s*(${STAMP})\s*\(UTC\+8\)`, 'i').exec(text)?.[1] ??
    new RegExp(String.raw`will run from[^\n]*?until\s*(${STAMP})\s*\(UTC\+8\)`, 'i').exec(text)?.[1];
  return {
    id,
    start: startIso,
    open: new Date(Date.parse(startIso) + h * 3_600_000).toISOString(),
    ...(end ? { end: at(end, 8) } : {}),
  };
}
