/**
 * A game team as you'd field it (owner's report 2026-10-10: "if units exist that do a job better, obviously they
 * should be picked"): for each slot, in the game's own order, the first listed character you own, never one twice.
 * A slot with none of yours shows its first pick. Game-free: each game hands over its own "may join" rule.
 */
import type { TeamAccount, TeamPreset } from '../contract';

export function fillTeam(preset: TeamPreset, owned: (id: string) => boolean, mayJoin: (team: string[], id: string) => boolean = () => true): string[] {
  return present(firstPicks(preset, owned, mayJoin));
}

/** Per slot (by position), the first listed character you own, never one twice; undefined = an empty slot. */
function firstPicks(preset: TeamPreset, owned: (id: string) => boolean, mayJoin: (team: string[], id: string) => boolean): (string | undefined)[] {
  const picks: (string | undefined)[] = [];
  for (const slot of preset.slots) {
    const taken = present(picks);
    const free = slot.characters.filter((id) => !taken.includes(id) && mayJoin(taken, id));
    picks.push(free.find(owned) ?? free[0]);
  }
  return picks;
}

const present = (xs: (string | undefined)[]) => xs.filter((x): x is string => Boolean(x));

/** One check of a team for `bestFill`: its kit value and damage dealer (the game's own check, as My teams scores it). */
export type FillScore = (team: string[], dd?: string) => { value: number; dd: string } | undefined;

const fillCache = new Map<string, string[]>();
const FILL_CACHE_MAX = 2000;

/** What a fill depends on, for one preset: its slots and, for every character in them, what the account says. */
export function fillKey(preset: TeamPreset, account: TeamAccount): string {
  const ids = [...new Set(preset.slots.flatMap((s) => s.characters))];
  const facts = ids.map((id) => {
    if (!account.owned(id)) return `${id}:-${account.skip?.(id) ? 's' : ''}`;
    return `${id}:${account.dupes(id)}:${account.potential?.(id) ?? ''}:${account.weapon?.(id)?.id ?? ''}:${account.skip?.(id) ? 's' : ''}:${JSON.stringify(account.build?.(id) ?? null)}`;
  });
  return `${preset.id}|${JSON.stringify(preset.slots.map((s) => s.characters))}|${account.assumeAverage ? 'a' : ''}${account.showLeaks ? 'l' : ''}|${facts.join(',')}`;
}

/**
 * A game team as you'd field it, the better unit picked (owner, 2026-10-10: "When I build my own team it's correct
 * but the recommended stuff just is wrong"; T40). Start from `fillTeam`; then each slot holding one of yours takes the
 * owned pick from its list that gives the team the highest kit value, scored exactly as My teams scores it (`score`).
 * The damage dealer's slot stays; a slot with none of yours keeps its first pick. Same team, same answer: cached.
 */
export function bestFill(preset: TeamPreset, account: TeamAccount, mayJoin: (team: string[], id: string) => boolean, score: FillScore): string[] {
  const key = fillKey(preset, account);
  const hit = fillCache.get(key);
  if (hit) return [...hit];
  const owned = account.owned;
  const picks = firstPicks(preset, owned, mayJoin);
  const team = present;
  const start = score(team(picks));
  if (start) {
    // Every slot that holds one of yours tries each of your characters its list names (the damage dealer's slot
    // stays): every combination, so two slots that share names (Sunday in both) still find the best pair.
    const options = preset.slots.map((slot, i) => {
      const now = picks[i];
      if (!now || now === start.dd || !owned(now)) return [now];
      return [...new Set([now, ...slot.characters.filter((id) => owned(id) && id !== start.dd)])];
    });
    let best = { value: start.value, team: [...picks] };
    const walk = (i: number, chosen: (string | undefined)[]) => {
      if (i === options.length) {
        if (chosen.join() === picks.join()) return;
        const v = score(team(chosen), start.dd);
        if (v && v.value > best.value + 1e-9) best = { value: v.value, team: [...chosen] };
        return;
      }
      for (const id of options[i] ?? []) {
        if (id && chosen.includes(id)) continue;
        if (id && !mayJoin(team(chosen), id)) continue;
        walk(i + 1, [...chosen, id]);
      }
    };
    walk(0, []);
    picks.splice(0, picks.length, ...best.team);
  }
  const out = team(picks);
  if (fillCache.size >= FILL_CACHE_MAX) fillCache.clear();
  fillCache.set(key, out);
  return [...out];
}

/** A game team with the owner's own slot lists where they edited them (hsr-decisions 31; both games). */
export function withOwnerLists(preset: TeamPreset, account: TeamAccount): TeamPreset {
  const l = account.teamList?.(preset.id);
  return l && l.some((slot) => slot.length) ? { ...preset, slots: preset.slots.map((s, i) => (l[i]?.length ? { ...s, characters: l[i] } : s)) } : preset;
}
