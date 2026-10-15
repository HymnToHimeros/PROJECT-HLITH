/** Kit check tags: the cheat sheet's answers laid onto the kit text, each tag with its quote (mirrors ZZZ). */
import type { Kit } from '../../../core/contract';
import { eventWord } from './check';
import type { CharacterSheet, Entry } from './types';

const WHO: Record<Entry['to'], string> = {
  self: 'Goes to them only',
  team: 'Goes to the whole team',
  controlled: 'Goes to the controlled operator (read as the damage dealer)',
  enemy: 'Works on the enemy, so whoever hits it gains',
  teammate: 'Goes to one teammate the game picks',
};
const ELEMENT: Record<string, string> = { physical: 'Physical', heat: 'Heat', cryo: 'Cryo', electric: 'Electric', nature: 'Nature' };

/** The tag in plain sentences: who gets it, limits, what it sets up or needs, what you must do. */
function noteOf(e: Entry): string {
  const out = [`${WHO[e.to]}.`];
  if (e.on) out.push('Only on with the right team (see the score for whether yours meets it).');
  const only = [...(e.limits?.elements ?? []).map((x) => `${ELEMENT[x] ?? x} DMG`), ...(e.limits?.arts !== undefined ? [e.limits.arts ? 'Arts DMG' : 'Physical DMG'] : []), ...(e.limits?.skills ?? []).map((s) => `${s} damage`)];
  if (only.length) out.push(`Counts only for ${only.join(', ')}.`);
  if (e.causes?.length) out.push(`Sets up ${e.causes.map(eventWord).join(', ')}.`);
  if (e.reacts?.length) out.push(`Needs ${e.reacts.map(eventWord).join(' or ')}.`);
  if (e.unverified) out.push(`Not counted: the text is unclear (${e.unverified}).`);
  out.push(`In the fight: ${e.setup}`);
  return out.join(' ');
}

export function withTags(kits: Kit[], sheets: CharacterSheet[]): Kit[] {
  const bySheet = new Map(sheets.map((s) => [s.characterId, s]));
  return kits.map((k) => {
    const sheet = bySheet.get(k.characterId);
    if (!sheet) return k;
    return {
      ...k,
      skills: k.skills.map((s) => {
        const entries = sheet.entries.filter((e) => e.piece === s.id);
        const note = sheet.nothing[s.id];
        return { ...s, does: entries.map((e) => e.tag), proof: entries.map((e) => ({ tag: e.tag, quote: e.quote, note: noteOf(e) })), ...(note ? { note } : {}) };
      }),
    };
  });
}
