/** Kit check tags: the cheat sheet's answers laid onto the kit text, each tag with its quote. */
import type { Kit } from '../../../core/contract';
import type { CharacterSheet, Entry } from './types';

const WHO: Record<Entry['to'], string> = {
  self: 'for themself',
  squad: 'for the whole squad',
  enemy: 'on the enemy',
  previous: 'for the character before them',
  next: 'for the character after them',
  'switch-in': 'for whoever switches in',
  teammate: 'for one teammate',
};

function noteOf(e: Entry): string {
  const parts = [WHO[e.to]];
  if (e.limits?.specialties) parts.push(`only ${e.limits.specialties.join(', ')}`);
  if (e.limits?.attributes) parts.push(`only ${e.limits.attributes.join(', ')}`);
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
