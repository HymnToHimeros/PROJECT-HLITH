/** Kit check tags: the cheat sheet's answers laid onto the kit text, each tag with its quote. */
import type { Kit } from '../../../core/contract';
import { eventWord } from './check';
import type { CharacterSheet, Entry } from './types';

const WHO: Record<Entry['to'], string> = {
  self: 'Goes to them only',
  squad: 'Goes to the whole squad',
  enemy: 'Works on the enemy, so whoever hits it gains',
  previous: 'Goes to the character before them in the squad order',
  next: 'Goes to the character after them in the squad order',
  'switch-in': 'Goes to whoever switches in next',
  teammate: 'Goes to one teammate the game picks',
};
const WHOSE = { previous: 'the character before them', next: 'the character after them', 'switch-in': 'whoever switches in', squad: 'the squad', unsaid: 'someone (the text does not say who; never counted)' } as const;

/** The tag in plain sentences: who gets it, limits, what it sets off, what you must do. */
function noteOf(e: Entry): string {
  const out = [`${WHO[e.to]}.`];
  if (e.on) out.push('Only on with the right squad (see the score for whether yours meets it).');
  const only = [...(e.limits?.specialties ?? []), ...(e.limits?.attributes ?? [])];
  if (only.length) out.push(`Counts only for ${only.join(', ')}.`);
  if (e.causes) out.push(`Gives ${WHOSE[e.causes.whose]} a ${eventWord(e.causes.event)}.`);
  if (e.reacts) out.push(`Reacts to their own ${[e.reacts].flat().map(eventWord).join(' or ')}.`);
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
        return {
          ...s,
          does: entries.map((e) => e.tag),
          proof: entries.map((e) => ({ tag: e.tag, quote: e.quote, note: noteOf(e) })),
          ...(note ? { note } : {}),
        };
      }),
    };
  });
}
