/**
 * Example material rows, so Farm shows what a plan looks like before the
 * game's material amounts are added. Generic names built from the game's own
 * words; amounts are made up and always shown with an EXAMPLE badge.
 */
import type { GameContract } from '../../core/contract';
import { known } from '../../core/contract/known';
import type { NeedRow } from './plan';

export function exampleNeeds(game: GameContract, characters: number): NeedRow[] {
  const n = Math.max(1, characters);
  const row = (id: string, name: string, perCharacter: number, perRun: number, stamina: number): NeedRow => {
    const amount = perCharacter * n;
    const runs = Math.ceil(amount / perRun);
    return { material: `example-${id}`, name, amount, runs: known(runs, 'user'), stamina: known(runs * stamina, 'user') };
  };
  return [
    row('ascension', 'Ascension material (boss drop)', 65, 3, 30),
    row('skill', `${game.terms.skill} material`, 140, 5, 30),
    row('level', 'Level-up material', 40, 6, 10),
    row('weapon', `${game.terms.weapon} material`, 60, 6, 10),
  ];
}
