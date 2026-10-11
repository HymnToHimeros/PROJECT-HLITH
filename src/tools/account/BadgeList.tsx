import { formatDate } from '../../core/time/reset';
import { Button } from '../../core/ui';
import type { BadgeDef, BadgeState, OwnerTitle } from './badges';
import { BadgeMark, runeName } from './BadgeMark';
import b from './badges.module.css';
import { badgeName } from './ProfileCard';

/**
 * Profile → Badges (T52): every badge, earned or "Not yet". Earned ones show the date when
 * the data has one (the pull, the bank entry); locked ones say how to earn them and link there.
 */
export function BadgeList({ badges, ownerTitle, onGo }: { badges: BadgeState[]; ownerTitle: OwnerTitle | null; onGo: (go: NonNullable<BadgeDef['go']>) => void }) {
  const earned = badges.filter((x) => x.earned).length;
  return (
    <section className={b.wrap} aria-labelledby="badges-title">
      <h3 id="badges-title" className={b.heading}>
        Badges
      </h3>
      <p className={b.summary}>
        <strong>{earned}</strong> of <strong>{badges.length}</strong> earned. Every badge comes from your own data; nothing is guessed.
      </p>
      <ul className={b.list}>
        {badges.map(({ def, earned: has, at }) => {
          const name = badgeName(def.id, ownerTitle);
          const rune = runeName(def.id);
          const cls = [b.item, has ? '' : b.itemLocked, def.kind === 'owner' ? b.itemOwner : ''].join(' ');
          return (
            <li key={def.id} className={cls} aria-label={`${name}: ${has ? 'earned' : 'not yet'}`}>
              <BadgeMark id={def.id} earned={has} size={def.kind === 'owner' ? 72 : 52} />
              <div className={b.itemText}>
                <p className={b.itemName}>{name}</p>
                <p className={b.itemHow}>{def.how}</p>
                {rune && <span className={b.itemMeta}>{rune}</span>}
                {has ? (
                  <span className={b.itemMeta}>{at ? `Earned ${formatDate(Date.parse(at))}` : 'Earned'}</span>
                ) : (
                  <>
                    <span className={b.notYet}>Not yet</span>
                    {def.go && (
                      <Button variant="quiet" className={b.go} onClick={() => onGo(def.go as NonNullable<BadgeDef['go']>)}>
                        How to earn it
                      </Button>
                    )}
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
