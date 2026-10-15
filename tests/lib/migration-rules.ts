/**
 * User data is never wiped. Migrations may add tables, columns and rows,
 * never remove them. Account deletion is a server function, not a migration.
 */
const DESTRUCTIVE: { pattern: RegExp; label: string }[] = [
  { pattern: /\bdrop\s+table\b/i, label: 'DROP TABLE' },
  { pattern: /\bdrop\s+column\b/i, label: 'DROP COLUMN' },
  { pattern: /\bdrop\s+schema\b/i, label: 'DROP SCHEMA' },
  { pattern: /\btruncate\b/i, label: 'TRUNCATE' },
  { pattern: /\bdelete\s+from\b/i, label: 'DELETE FROM' },
  { pattern: /\balter\s+table\b[^;]*\brename\b/i, label: 'RENAME (breaks existing data paths)' },
  { pattern: /\bon\s+delete\s+cascade\b/i, label: 'ON DELETE CASCADE' },
];

function stripComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--.*$/gm, '');
}

export function findDestructive(sql: string): string[] {
  const clean = stripComments(sql);
  return DESTRUCTIVE.filter((d) => d.pattern.test(clean)).map((d) => d.label);
}

/** Tables created in the SQL that carry user data (have a user_id column). */
export function userTables(sql: string): string[] {
  const clean = stripComments(sql);
  return [...clean.matchAll(/create table public\.(\w+)\s*\(([\s\S]*?)\n\);/gi)]
    .filter((m) => /\buser_id\b/.test(m[2] ?? ''))
    .map((m) => m[1] ?? '');
}

/** Problems with per-user walls: missing row-level security, or any delete policy. */
export function wallProblems(sql: string): string[] {
  const clean = stripComments(sql);
  const out: string[] = [];
  for (const t of userTables(sql)) {
    if (!new RegExp(`alter table public\\.${t} enable row level security`, 'i').test(clean)) out.push(`${t}: row-level security is off`);
    if (new RegExp(`create policy[^;]*on public\\.${t}\\s+for (delete|all)\\b`, 'i').test(clean)) out.push(`${t}: has a delete policy`);
  }
  return out;
}

/**
 * Temporary objects (functions or policies named _tmp…) that a migration creates. They are for a
 * one-off job by hand and must never ship: T80 found a _tmp SQL runner and an anon write policy
 * left in production. Dropping one is fine.
 */
export function tmpObjects(sql: string): string[] {
  const clean = stripComments(sql);
  const found: string[] = [];
  for (const m of clean.matchAll(/\bcreate\s+(?:or\s+replace\s+)?function\s+(?:"?\w+"?\.)?"?(_tmp\w*)"?/gi)) found.push(`function ${m[1]}`);
  for (const m of clean.matchAll(/\bcreate\s+policy\s+"?(_tmp[^"\s]*)"?/gi)) found.push(`policy ${m[1]}`);
  return found;
}

/** SECURITY DEFINER functions (they run with their owner's rights) in the SQL. */
export function definerFunctions(sql: string): string[] {
  const clean = stripComments(sql);
  const out = new Set<string>();
  for (const m of clean.matchAll(/create\s+(?:or\s+replace\s+)?function\s+public\.(\w+)\s*\([^)]*\)[\s\S]*?\$\$/gi)) if (/security\s+definer/i.test(m[0])) out.add(m[1] ?? '');
  return [...out];
}

/** Functions whose EXECUTE is taken away from signed-out visitors (anon, or public which anon is part of). */
export function revokedFromAnon(sql: string): Set<string> {
  const clean = stripComments(sql);
  return new Set(
    [...clean.matchAll(/revoke\s+(?:execute|all)[^;]*?on\s+function\s+public\.(\w+)\s*\([^)]*\)\s+from\s+([^;]*);/gi)]
      .filter((m) => /\b(anon|public)\b/i.test(m[2] ?? ''))
      .map((m) => m[1] ?? ''),
  );
}
