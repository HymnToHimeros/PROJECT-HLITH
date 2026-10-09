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
