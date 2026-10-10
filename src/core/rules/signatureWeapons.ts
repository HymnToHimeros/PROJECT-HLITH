/**
 * A character's signature weapon as one more piece of their kit (owner's job
 * T18): its effect in the game's words, counted only when the saved build has
 * that weapon equipped. Game-free: each game passes its weapon list.
 */
import type { Kit, Weapon } from '../contract';

export const SIGNATURE_PIECE = 'signature-weapon';

export function withSignatureWeapons(kits: Kit[], weapons: (Weapon & { effect?: { name: string; text: string } })[], word: string): Kit[] {
  const byOwner = new Map(weapons.filter((w) => w.madeFor && w.effect).map((w) => [w.madeFor ?? '', w]));
  return kits.map((k) => {
    const w = byOwner.get(k.characterId);
    if (!w?.effect) return k;
    return {
      ...k,
      skills: [...k.skills, { id: SIGNATURE_PIECE, label: `Signature ${word}: ${w.name} · ${w.effect.name}`, kind: 'weapon' as const, unlock: { weapon: w.id }, does: [], gameText: w.effect.text }],
    };
  });
}
