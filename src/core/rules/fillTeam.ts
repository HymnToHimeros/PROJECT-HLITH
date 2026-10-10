/**
 * A game team as you'd field it (owner's report 2026-10-10: "if units exist that do a job better, obviously they
 * should be picked"): for each slot, in the game's own order, the first listed character you own, never one twice.
 * A slot with none of yours shows its first pick. Game-free: each game hands over its own "may join" rule.
 */
import type { TeamPreset } from '../contract';

export function fillTeam(preset: TeamPreset, owned: (id: string) => boolean, mayJoin: (team: string[], id: string) => boolean = () => true): string[] {
  const team: string[] = [];
  for (const slot of preset.slots) {
    const free = slot.characters.filter((id) => !team.includes(id) && mayJoin(team, id));
    const pick = free.find(owned) ?? free[0];
    if (pick) team.push(pick);
  }
  return team;
}
