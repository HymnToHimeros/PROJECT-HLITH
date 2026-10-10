/**
 * What a team score took from your account, in plain words (owner's job T18):
 * dupes, the second upgrade track (HSR Enhanced, ZZZ Agent Potential) and the
 * signature weapon in the saved build. Honest: what isn't saved is said, and scored at base.
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
  /** Their signature weapon (id and name), when they have one. */
  signature?: { id: string; name: string };
}

export function accountNotes(id: string, account: TeamAccount, facts: AccountFacts): { notes: string[]; theory: boolean } {
  if (!account.owned(id)) return { notes: [`Not owned: scored as theory at ${facts.dupePrefix}0${facts.track ? `, without the ${facts.track}` : ''}.`], theory: true };
  // What counted leads, in one short line (FRAME shows two lines per suggestion); what's missing follows.
  const counted: string[] = [];
  const missing: string[] = [];
  const dupes = account.dupes(id);
  counted.push(dupes > 0 ? `${facts.dupePrefix}${dupes}` : `${facts.dupePrefix}0 (no copies saved)`);
  if (facts.track) {
    const p = account.potential?.(id);
    if (p === undefined) missing.push(`${facts.track} not saved: scored without it.`);
    else if (p > 0) counted.push(`${facts.track}${facts.trackLevels ? ` ${p}` : ''}`);
    else missing.push(`No ${facts.track}: scored without it.`);
  }
  const w = account.weapon?.(id);
  const sig = facts.signature;
  if (sig && w && w.id === sig.id) counted.push(`signature ${sig.name}`);
  else if (sig) missing.push(w ? `${w.name} saved, not signature ${sig.name}: not counted.` : `Signature ${sig.name} not saved: not counted.`);
  else missing.push(w ? `${w.name}: only signature weapons count.` : 'No signature weapon to count.');
  const notes = [`Counted: ${counted.join(', ')}.`, ...missing];
  if (facts.locked) notes.push(`${facts.locked} kit piece${facts.locked === 1 ? '' : 's'} still locked.`);
  return { notes, theory: false };
}
