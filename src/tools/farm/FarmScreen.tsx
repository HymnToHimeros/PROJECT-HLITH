import { useMemo } from 'react';
import type { ModuleScreenProps } from '../../core/registry/modules';
import { GameHeading } from '../pulls/shared';
import { inScope, tagFor, useGameLists } from '../today/lists';
import { Farm } from './Farm';
import f from './farm.module.css';

/** Farm module: one plan per game (materials never mix between games). */
export default function FarmScreen({ games, scope }: ModuleScreenProps) {
  const shown = useMemo(() => inScope(games, scope), [games, scope]);
  const lists = useGameLists(shown);
  if (!lists) return null;
  const several = shown.length > 1;
  return (
    <div className={f.stack}>
      {shown.map((g) => (
        <section key={g.id} className={f.stack} aria-label={g.name}>
          <GameHeading game={g} show={several} />
          <Farm game={g} characters={lists[g.id]?.characters ?? []} materials={lists[g.id]?.materials ?? []} tag={tagFor(g, several)} />
        </section>
      ))}
    </div>
  );
}
