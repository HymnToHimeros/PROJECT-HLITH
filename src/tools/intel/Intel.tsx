import { useEffect, useState } from 'react';
import type { Banner, Character, GameContract } from '../../core/contract';
import { formatDate } from '../../core/time/reset';
import { EmptyState, ExampleNotice, ExampleTag, NoData, Timer, UnverifiedTag } from '../../core/ui';
import { GameHeading } from '../pulls/shared';
import { exampleIntel, intelItems, type IntelItem } from './intel';
import n from './intel.module.css';

interface Props {
  game: GameContract;
  now: number;
  heading: boolean;
}

/** Intel for one game: upcoming content by type, every item unverified with its source. */
export function GameIntel({ game, now, heading }: Props) {
  const [lists, setLists] = useState<{ characters: Character[]; banners: Banner[] } | null>(null);
  useEffect(() => {
    let alive = true;
    void Promise.all([game.data.characters(), game.data.banners()]).then(([characters, banners]) => {
      if (alive) setLists({ characters, banners });
    });
    return () => {
      alive = false;
    };
  }, [game]);
  if (!lists) return null;

  const real = intelItems(game, lists.characters, lists.banners, now);
  const example = real.length === 0;
  const items = example ? exampleIntel(game, now) : real;
  const groups = new Map<string, IntelItem[]>();
  for (const item of items) groups.set(item.group, [...(groups.get(item.group) ?? []), item]);

  return (
    <section className={n.stack} aria-label={game.name}>
      <GameHeading game={game} show={heading} />
      {example && (
        <ExampleNotice>Nothing upcoming is listed for this game yet; adding it is on us, not you. The cards below only show what Intel will look like.</ExampleNotice>
      )}
      {[...groups].map(([group, list]) => (
        <div key={group} className={n.section}>
          <h3 className={n.sectionLabel}>
            NEW {group.toUpperCase()} · {list.length}
          </h3>
          <div className={n.grid}>
            {list.map((item) => (
              <IntelCard key={item.id} item={item} example={example} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function IntelCard({ item, example }: { item: IntelItem; example: boolean }) {
  return (
    <article className={n.card} aria-label={item.title}>
      <div className={n.tags}>
        <UnverifiedTag source={item.sources.join(', ')} />
        {example && <ExampleTag />}
      </div>
      <h4 className={n.title}>{item.title}</h4>
      <span className={n.detail}>{item.detail}</span>
      <dl className={n.facts}>
        <div>
          <dt>{item.whenLabel}</dt>
          <dd>
            {item.when === null ? (
              <NoData dash={false} />
            ) : (
              <>
                {formatDate(item.when)} · <Timer to={item.when} prefix="in" />
              </>
            )}
          </dd>
        </div>
        <div>
          <dt>Reliability</dt>
          <dd>
            <NoData dash={false} />
          </dd>
        </div>
      </dl>
    </article>
  );
}

/** Shown instead of the cards while the viewer hides leaks. */
export function IntelHidden({ onShow }: { onShow: () => void }) {
  return <EmptyState title="Leaks are hidden" body="Everything in Intel is unverified, so it stays hidden while “Hide leaks” is on." action={{ label: 'Show leaks', onClick: onShow }} />;
}
