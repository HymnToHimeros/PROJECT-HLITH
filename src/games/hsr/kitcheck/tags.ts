/** Kit check tags: the cheat sheet's answers laid onto the kit text, each tag with its quote. */
import type { Kit } from '../../../core/contract';
import { conditionWords, EVENT_WORD, KIND_WORD } from './check';
import type { CharacterSheet, Entry } from './types';

const WHO: Record<Entry['to'], string> = {
  self: 'Goes to them only',
  allies: 'Goes to every ally, them included',
  teammates: 'Goes to their teammates, not them',
  'chosen-ally': 'Goes to one ally you pick (your damage dealer)',
  enemy: 'Works on the enemy, so whoever hits it gains',
};
const FROM = { self: 'they', teammates: 'a teammate', any: 'anyone' } as const;

/** The tag in plain sentences: who gets it, when it's on, limits, what it sets off, what you must do. */
function noteOf(e: Entry): string {
  const out = [`${WHO[e.to]}.`];
  if (e.on) out.push(`Only on when the team has ${conditionWords(e.on).replace(/ in the team$/, '')}.`);
  const only = [...(e.limits?.kinds ?? []).map((k) => KIND_WORD[k]), ...(e.limits?.paths ?? []), ...(e.limits?.elements ?? [])];
  if (only.length) out.push(`Counts only for ${only.join(', ')}.`);
  if (e.causes) out.push(`Makes a ${EVENT_WORD[e.causes]}, which some damage dealers' kits react to.`);
  if (e.reacts) out.push(`Reacts when ${FROM[e.reacts.from]} make${e.reacts.from === 'self' ? '' : 's'} a ${EVENT_WORD[e.reacts.event]}.`);
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
