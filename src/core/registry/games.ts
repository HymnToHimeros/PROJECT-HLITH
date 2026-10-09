import { MODULE_IDS, type GameContract, type GameId } from '../contract';
import { ventProblems } from '../theme/contrast';

const games = new Map<GameId, GameContract>();

/** Everything wrong with a game record. Empty = it can be registered. */
export function gameProblems(g: GameContract): string[] {
  const out: string[] = [];
  const say = (msg: string) => out.push(`${g.id || '(no id)'}: ${msg}`);

  if (!/^[a-z][a-z0-9-]*$/.test(g.id)) say('id must be lowercase letters, digits and dashes');
  if (!g.short.trim() || !g.name.trim()) say('short and name are required');
  for (const p of ventProblems(g.vent)) say(p);

  const unknownModules = g.modules.filter((m) => !(MODULE_IDS as readonly string[]).includes(m));
  if (unknownModules.length) say(`unknown modules: ${unknownModules.join(', ')}`);
  if (g.modules.length === 0) say('needs at least one module');
  const sameSet =
    g.defaultOrder.length === g.modules.length &&
    new Set(g.defaultOrder).size === g.defaultOrder.length &&
    g.defaultOrder.every((m) => g.modules.includes(m));
  if (!sameSet) say('defaultOrder must list exactly the modules, once each');

  if (g.servers.length === 0) say('needs at least one server');
  if (g.reset.hour < 0 || g.reset.hour > 23 || g.reset.weekday < 0 || g.reset.weekday > 6) say('reset hour 0–23, weekday 0–6');

  const currencies = new Set(g.currencies.map((c) => c.id));
  const bannerTypes = new Set(g.bannerTypes.map((b) => b.id));
  for (const b of g.bannerTypes) {
    if (!currencies.has(b.pullItem)) say(`banner type ${b.id} uses unknown pull item ${b.pullItem}`);
  }
  for (const c of g.currencies) {
    for (const bt of c.pullItemFor ?? []) if (!bannerTypes.has(bt)) say(`currency ${c.id} names unknown banner type ${bt}`);
  }
  for (const [type, bt] of Object.entries(g.historyMapping?.gachaTypes ?? {})) {
    if (!bannerTypes.has(bt)) say(`history gacha_type ${type} maps to unknown banner type ${bt}`);
  }
  const incomeIds = new Set<string>();
  for (const r of g.income) {
    if (incomeIds.has(r.id)) say(`income row ${r.id} listed twice`);
    incomeIds.add(r.id);
    if (!currencies.has(r.currency)) say(`income row ${r.id} uses unknown currency ${r.currency}`);
  }
  for (const [label, list] of [
    ['element', g.elements],
    ['role', g.roles],
    ['server', g.servers],
    ['currency', g.currencies],
    ['stamina pool', g.stamina],
  ] as const) {
    const ids = list.map((x) => x.id);
    if (new Set(ids).size !== ids.length) say(`duplicate ${label} ids`);
  }
  return out;
}

export function registerGame(g: GameContract): void {
  const problems = gameProblems(g);
  if (games.has(g.id)) problems.push(`${g.id}: registered twice`);
  if (problems.length) throw new Error(`Game record rejected:\n${problems.join('\n')}`);
  games.set(g.id, g);
}

export function listGames(): GameContract[] {
  return [...games.values()];
}

export function getGame(id: GameId): GameContract | undefined {
  return games.get(id);
}

/** Test helper. */
export function clearGames(): void {
  games.clear();
}
