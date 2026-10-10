/**
 * What a team score took from your account, in plain words (owner's job T18):
 * dupes, the second upgrade track (HSR Enhanced, ZZZ Agent Potential) and the
 * saved weapon. Honest: what isn't saved is said, and scored at base.
 */
import type { TeamAccount } from '../contract';

export interface AccountFacts {
  /** 'E' (Eidolon) or 'M' (Mindscape). */
  dupePrefix: string;
  /** The upgrade track's name, e.g. 'Enhanced kit' or 'Agent Potential'; undefined = the character has none. */
  track?: string;
  /** The track has levels (Agent Potential 1–6), not just on/off (HSR's Enhanced kit). */
  trackLevels?: boolean;
  /** Pieces of this character's kit the check left locked. */
  locked: number;
}

export function accountNotes(id: string, account: TeamAccount, facts: AccountFacts): { notes: string[]; theory: boolean } {
  if (!account.owned(id)) return { notes: [`Not owned: scored as theory at ${facts.dupePrefix}0${facts.track ? `, without the ${facts.track}` : ''}.`], theory: true };
  const notes: string[] = [];
  const dupes = account.dupes(id);
  notes.push(dupes > 0 ? `${facts.dupePrefix}${dupes} counted.` : `${facts.dupePrefix}0 counted (no copies saved).`);
  if (facts.track) {
    const p = account.potential?.(id);
    const level = facts.trackLevels ? ` ${p}` : '';
    notes.push(p === undefined ? `${facts.track}: not saved, scored without it.` : p > 0 ? `${facts.track}${level} counted.` : `${facts.track}: none, scored without it.`);
  }
  if (facts.locked) notes.push(`${facts.locked} kit piece${facts.locked === 1 ? '' : 's'} still locked at this level.`);
  const w = account.weapon?.(id);
  notes.push(w ? `Weapon in your build: ${w.name}. Its effect isn't counted yet.` : 'No weapon saved: weapon effects aren’t counted.');
  return { notes, theory: false };
}
