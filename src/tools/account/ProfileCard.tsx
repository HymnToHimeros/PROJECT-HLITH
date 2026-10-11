import type { CSSProperties, ReactNode } from 'react';
import { formatNumber } from '../../core/time/format';
import { GameTag } from '../../core/ui';
import { BADGE_BY_ID, OWNER_TITLES, type BadgeId, type OwnerTitle } from './badges';
import { BadgeMark, RAVEN } from './BadgeMark';
import c from './card.module.css';
import type { FrameId, NameColor } from './profile';

export interface CardCharacter {
  name: string;
  portrait?: string | undefined;
  rarity: 'top' | 'mid';
  elementColor: string;
}
export type CardFeatured =
  | ({ kind: 'character'; key: string; gameShort: string; vent: string } & CardCharacter)
  | { kind: 'team'; key: string; gameShort: string; vent: string; name: string; members: CardCharacter[] };

export interface CardStats {
  gameShort: string;
  vent: string;
  total: number;
  tops: number;
  topLabel: string;
}

export interface ProfileCardProps {
  name: string;
  title: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  /** Shown behind the banner and when there is none. */
  bannerFallback: string;
  frame: FrameId;
  nameColor: NameColor;
  /** The colour for "Game colour" (frame and name). */
  vent: string;
  badge: BadgeId;
  ownerTitle?: OwnerTitle | null | undefined;
  featured: CardFeatured[];
  /** null = don't show the stats row (hidden, or no data); [] is never passed. */
  stats: CardStats[] | null;
  /** "12 of 16 badges" when known. */
  badgeCount?: { earned: number; total: number } | undefined;
  /** Extra line under the name (e.g. "Shared by"). */
  note?: ReactNode;
  actions?: ReactNode;
  /** Smaller layout, e.g. inside a share sheet. */
  compact?: boolean;
}

export const badgeName = (id: BadgeId, ownerTitle?: OwnerTitle | null) => (id === 'owner' ? (ownerTitle ?? OWNER_TITLES[0]) : BADGE_BY_ID[id].name);

/**
 * The profile card (T52), like an in-game profile card: banner, framed picture, name in your
 * colour, title, your badge, up to four favourites and your own pull numbers. The same card
 * shows on your profile, as the live preview while you edit, and to someone you share a team
 * with (if you allowed it). Everything on it comes from the data given; nothing is filled in.
 */
export function ProfileCard(props: ProfileCardProps) {
  const { name, title, avatarUrl, bannerUrl, bannerFallback, frame, nameColor, vent, badge, ownerTitle, featured, stats, badgeCount, note, actions, compact } = props;
  const owner = badge === 'owner';
  const style = { '--card-vent': vent } as CSSProperties;
  return (
    <article className={`${c.card} ${compact ? c.compact : ''} ${owner ? c.ownerCard : ''}`} style={style} aria-label={`Profile card: ${name}`}>
      <div className={c.banner} style={{ background: bannerFallback }}>
        {bannerUrl && <img src={bannerUrl} alt="" className={c.bannerImg} />}
        {owner && <div className={c.skyWash} aria-hidden="true" />}
      </div>
      <div className={c.head}>
        <Framed frame={frame} src={avatarUrl} letter={name} />
        <div className={c.identity}>
          <h2 className={c.name} data-color={nameColor}>
            {name}
          </h2>
          {title && <p className={c.title}>{title}</p>}
          {note && <p className={c.note}>{note}</p>}
        </div>
        <div className={c.badge}>
          <BadgeMark id={badge} size={owner ? (compact ? 60 : 76) : compact ? 44 : 56} />
          <span className={owner ? c.badgeNameOwner : c.badgeName}>{badgeName(badge, ownerTitle)}</span>
          {badgeCount && (
            <span className={c.badgeCount}>
              {badgeCount.earned} of {badgeCount.total} badges
            </span>
          )}
        </div>
      </div>

      {featured.length > 0 && (
        <ul className={c.showcase} aria-label="Showcase">
          {featured.map((f) => (
            <li key={f.key} className={c.slot} style={{ '--slot-vent': f.vent } as CSSProperties}>
              {f.kind === 'character' ? (
                <>
                  <Portrait ch={f} big />
                  <span className={c.slotName}>{f.name}</span>
                  <GameTag label={f.gameShort} vent={f.vent} />
                </>
              ) : (
                <>
                  <div className={c.teamFaces}>
                    {f.members.slice(0, 4).map((m, i) => (
                      <Portrait key={`${m.name}-${i}`} ch={m} />
                    ))}
                  </div>
                  <span className={c.slotName}>{f.name}</span>
                  <GameTag label={f.gameShort} vent={f.vent} />
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {stats && (
        <dl className={c.stats} aria-label="Pull numbers">
          {stats.map((s) => (
            <div key={s.gameShort} className={c.stat}>
              <dt>
                <GameTag label={s.gameShort} vent={s.vent} />
              </dt>
              <dd>
                <span className={c.statBig}>{formatNumber(s.total)}</span> pulls
                <span className={c.statSep} aria-hidden="true">
                  ·
                </span>
                <span className={c.statBig}>{formatNumber(s.tops)}</span> {s.topLabel}
                {s.tops > 0 && (
                  <>
                    <span className={c.statSep} aria-hidden="true">
                      ·
                    </span>
                    <span className={c.statBig}>{formatNumber(Math.round(s.total / s.tops))}</span> per {s.topLabel}
                  </>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {actions && <div className={c.actions}>{actions}</div>}
    </article>
  );
}

function Portrait({ ch, big = false }: { ch: CardCharacter; big?: boolean }) {
  return (
    <span className={big ? `${c.face} ${c.faceBig}` : c.face} data-rarity={ch.rarity} style={{ '--el': ch.elementColor } as CSSProperties} title={ch.name}>
      {ch.portrait ? <img src={ch.portrait} alt="" loading="lazy" /> : <span aria-hidden="true">{ch.name.charAt(0)}</span>}
    </span>
  );
}

/** The profile picture in its frame. The owner's sky frame has the two ravens circling it. */
export function Framed({ frame, src, letter, size = 'lg' }: { frame: FrameId; src: string | null; letter: string; size?: 'lg' | 'sm' }) {
  return (
    <span className={`${c.frame} ${size === 'sm' ? c.frameSm : ''}`} data-frame={frame}>
      <span className={c.avatar}>{src ? <img src={src} alt="" /> : <span aria-hidden="true">{letter.charAt(0).toUpperCase() || '?'}</span>}</span>
      {frame === 'runes' && <span className={c.runeRing} aria-hidden="true" />}
      {frame === 'sky' && (
        <svg className={c.skyRing} viewBox="0 0 120 120" aria-hidden="true">
          <circle cx="60" cy="60" r="57" fill="none" stroke="var(--rarity-top)" strokeWidth="1" strokeDasharray="1 5" opacity="0.8" />
          <g className={c.skyRavens}>
            <path d={RAVEN} transform="translate(60 5) scale(1.1)" fill="#06050f" stroke="var(--rarity-top)" strokeWidth="0.6" />
            <path d={RAVEN} transform="translate(60 115) rotate(180) scale(1.1)" fill="#06050f" stroke="var(--rarity-top)" strokeWidth="0.6" />
          </g>
        </svg>
      )}
    </span>
  );
}
