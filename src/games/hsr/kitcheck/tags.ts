/** Kit check tags: the cheat sheet's answers laid onto the kit text, each tag with its quote. */
import type { Kit } from '../../../core/contract';
import { conditionWords, KIND_WORD } from './check';
import type { CharacterSheet, Entry } from './types';

const WHO: Record<Entry['to'], string> = {
  self: 'for themself',
  allies: 'for all allies',
  teammates: 'for teammates (not themself)',
  'chosen-ally': 'for one ally you pick',
  enemy: 'on the enemy',
};

function noteOf(e: Entry): string {
  const parts = [WHO[e.to]];
  if (e.on) parts.push(`when ${conditionWords(e.on)}`);
  if (e.limits?.kinds) parts.push(`only ${e.limits.kinds.map((k) => KIND_WORD[k]).join(', ')}`);
  if (e.limits?.paths) parts.push(`only ${e.limits.paths.join(', ')}`);
  if (e.limits?.elements) parts.push(`only ${e.limits.elements.join(', ')}`);
  if (e.unverified) parts.push(`unverified: ${e.unverified}`);
  parts.push(`setup: ${e.setup}`);
  return parts.join(' · ');
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
