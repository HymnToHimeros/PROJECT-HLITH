import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

/**
 * Which layer may import which. The layers, from the bottom up:
 *   core/   the skeleton (shell, registry, contract types, shared parts)
 *   tools/  the shelves and nerves (modules that work for any game)
 *   games/  the flesh (one folder per game)
 * Only src/main.tsx wires games into the app.
 */
export type Layer = 'core' | 'tools' | 'games' | 'root';

export interface Violation {
  file: string;
  specifier: string;
  rule: string;
}

const SOURCE = /\.(ts|tsx|js|jsx|mts|cts)$/;

const STATIC_PATTERNS = [
  /\b(?:import|export)\s[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]/g,
  /\bimport\s*['"]([^'"]+)['"]/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
];
const TEMPLATE_IMPORT = /\bimport\s*\(\s*`([^`]*)`/g;

export function findSpecifiers(code: string): { literal: string[]; template: string[] } {
  const literal = new Set<string>();
  for (const pattern of STATIC_PATTERNS) {
    for (const m of code.matchAll(pattern)) if (m[1]) literal.add(m[1]);
  }
  const template = [...code.matchAll(TEMPLATE_IMPORT)].map((m) => m[1] ?? '');
  return { literal: [...literal], template };
}

/** Where a file lives: its layer and, inside games/, which game folder. */
export function locate(srcDir: string, absPath: string): { layer: Layer; game?: string } {
  const rel = relative(srcDir, absPath);
  if (rel.startsWith('..')) return { layer: 'root' };
  const [top, second] = rel.split(sep);
  if (top === 'core' || top === 'tools') return { layer: top };
  if (top === 'games') {
    // games/index.ts is the list of games, not a game.
    return second && second !== 'index.ts' ? { layer: 'games', game: second } : { layer: 'root' };
  }
  return { layer: 'root' };
}

/** Turn an import specifier into an absolute path, or null for npm packages. */
export function resolveSpecifier(srcDir: string, fromFile: string, specifier: string): string | null {
  if (specifier.startsWith('.')) return resolve(dirname(fromFile), specifier);
  if (specifier.startsWith('@/')) return resolve(srcDir, specifier.slice(2));
  if (specifier.startsWith('src/')) return resolve(srcDir, specifier.slice(4));
  return null;
}

export function checkFile(srcDir: string, file: string, code: string): Violation[] {
  const from = locate(srcDir, file);
  if (from.layer === 'root') return [];
  const out: Violation[] = [];
  const { literal, template } = findSpecifiers(code);

  for (const specifier of literal) {
    const target = resolveSpecifier(srcDir, file, specifier);
    if (!target) continue;
    const to = locate(srcDir, target);
    const isGamesIndex = relative(srcDir, target).split(sep)[0] === 'games';
    const rule = ruleBroken(from, to, isGamesIndex);
    if (rule) out.push({ file: relative(srcDir, file), specifier, rule });
  }
  for (const text of template) {
    if (from.layer !== 'games' && /games/.test(text)) {
      out.push({ file: relative(srcDir, file), specifier: text, rule: `${from.layer}/ may not load games/ dynamically` });
    }
  }
  return out;
}

function ruleBroken(
  from: { layer: Layer; game?: string },
  to: { layer: Layer; game?: string },
  targetIsInGames: boolean,
): string | null {
  if ((from.layer === 'core' || from.layer === 'tools') && targetIsInGames) {
    return `${from.layer}/ may not import from games/`;
  }
  if (from.layer === 'core' && to.layer === 'tools') return 'core/ may not import from tools/';
  if (from.layer === 'games' && to.layer === 'tools') return 'games/ may not import from tools/ (games are data + rules)';
  if (from.layer === 'games' && to.layer === 'games' && to.game !== from.game) {
    return `games/${from.game} may not import from games/${to.game}`;
  }
  if (from.layer === 'games' && targetIsInGames && to.layer === 'root') {
    return 'a game may not import the list of games';
  }
  return null;
}

export function listSourceFiles(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  return entries.flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return listSourceFiles(full);
    return SOURCE.test(name) ? [full] : [];
  });
}

export function checkTree(srcDir: string): Violation[] {
  return listSourceFiles(srcDir).flatMap((file) => checkFile(srcDir, file, readFileSync(file, 'utf8')));
}
