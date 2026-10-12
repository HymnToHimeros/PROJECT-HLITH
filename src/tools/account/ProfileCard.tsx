import type { CSSProperties, ReactNode } from 'react';
import { formatNumber } from '../../core/time/format';
import { formatDate } from '../../core/time/reset';
import { ThemeMotif } from '../../core/theme/ThemeArt';
import type { Theme } from '../../core/theme/themes';
import { GameTag } from '../../core/ui';
import { BADGE_BY_ID, OWNER_TITLES, type BadgeId, type OwnerTitle } from './badges';
import { BadgeMark, RAVEN } from './BadgeMark';
import c from './card.module.css';
import { OwnerBadgeArt, OwnerFrameArt, OwnerNameArt } from './ownerArt/Owner';
import type { OwnerStyle } from './ownerArt/style';
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
  /** T64 B2: average pulls per top result (null: none yet), and the 50/50 record. */
  averagePity?: number | null | undefined;
  won?: number | undefined;
  lost?: number | undefined;
}

/** T64 B2: the luckiest top result from imported history. */
export interface CardLuckiest extends CardCharacter {
  gameShort: string;
  vent: string;
  topLabel: string;
  /** Which pull it came on. */
  pulls: number;
  time: string;
}

export interface ProfileCardProps {
  name: string;
  /** The username (T62), shown as @name under the name. */
  handle?: string | null | undefined;
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
  /** T64: the owner's badge, frame and name style. Pass it only for the owner's own card. */
  ownerStyle?: OwnerStyle | null | undefined;
  featured: CardFeatured[];
  /** T64 B2: the title is an earned one (shows a ✔). */
  titleEarned?: boolean | undefined;
  /** T64 B2: bio (only when the person allowed it), favourite game, a theme's art behind the card. */
  bio?: string | null | undefined;
  favGame?: { short: string; name: string; vent: string } | null | undefined;
  background?: Theme | null | undefined;
  /** T64 B2: up to 3 more badges on a shelf under the main one. */
  shelf?: BadgeId[] | undefined;
  /** T64 B2: the best team and the luckiest pull, when chosen / known and allowed. */
  bestTeam?: Extract<CardFeatured, { kind: 'team' }> | null | undefined;
  luckiest?: CardLuckiest | null | undefined;
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
  const { name, handle, title, avatarUrl, bannerUrl, bannerFallback, frame, nameColor, vent, badge, ownerTitle, featured, stats, badgeCount, note, actions, compact } = props;
  const shelf = (props.shelf ?? []).filter((id) => id !== badge).slice(0, 3);
  const { bestTeam, luckiest } = props;
  const owner = badge === 'owner';
  const look = props.ownerStyle ?? null;
  const badgeSize = owner ? (compact ? 60 : 76) : compact ? 44 : 56;
  const style = { '--card-vent': vent } as CSSProperties;
  return (
    <article className={`${c.card} ${compact ? c.compact : ''} ${owner ? c.ownerCard : ''}`} style={style} aria-label={`Profile card: ${name}`}>
      <div className={c.banner} style={{ background: bannerFallback }}>
        {!bannerUrl && props.background && (
          <span className={c.bannerArt} data-theme-preview={props.background} aria-hidden="true">
            <ThemeMotif theme={props.background} className={c.bannerMotif} />
          </span>
        )}
        {bannerUrl && <img src={bannerUrl} alt="" className={c.bannerImg} />}
        {owner && <div className={c.skyWash} aria-hidden="true" />}
      </div>
      <div className={c.head}>
        {look?.frame ? (
          <OwnerFrameArt n={look.frame} variant={look.frameVariant} src={avatarUrl} letter={name} size={compact ? 108 : 136} fallback={<Framed frame={frame} src={avatarUrl} letter={name} />} />
        ) : (
          <Framed frame={frame} src={avatarUrl} letter={name} />
        )}
        <div className={c.identity}>
          <h2 className={c.name} data-color={look?.name ? undefined : nameColor}>
            {look?.name ? <OwnerNameArt n={look.name} text={name} /> : name}
          </h2>
          {handle && <p className={c.handle}>@{handle}</p>}
          {title && (
            <p className={c.title}>
              {title}
              {props.titleEarned && (
                <span className={c.earned} title="An earned title: it comes from a badge you hold">
                  {' '}
                  ✔
                </span>
              )}
            </p>
          )}
          {props.favGame && (
            <p className={c.fav}>
              Favourite game <GameTag label={props.favGame.short} vent={props.favGame.vent} />
            </p>
          )}
          {note && <p className={c.note}>{note}</p>}
        </div>
        <div className={c.badge}>
          {owner && look && look.badge > 0 ? <OwnerBadgeArt n={look.badge} size={badgeSize} fallback={<BadgeMark id="owner" size={badgeSize} />} /> : <BadgeMark id={badge} size={badgeSize} />}
          <span className={owner ? c.badgeNameOwner : c.badgeName}>{badgeName(badge, ownerTitle)}</span>
          {shelf.length > 0 && (
            <ul className={c.shelf} aria-label="Badge shelf">
              {shelf.map((id) => (
                <li key={id} title={badgeName(id, ownerTitle)}>
                  <BadgeMark id={id} size={compact ? 22 : 28} title={badgeName(id, ownerTitle)} />
                </li>
              ))}
            </ul>
          )}
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

      {props.bio && <p className={c.bio}>{props.bio}</p>}

      {(bestTeam || luckiest) && (
        <div className={c.extras}>
          {bestTeam && (
            <section className={c.extra} style={{ '--slot-vent': bestTeam.vent } as CSSProperties} aria-label="Best team">
              <span className={c.extraLabel}>Best team</span>
              <div className={c.teamRow}>
                {bestTeam.members.slice(0, 4).map((m, i) => (
                  <Portrait key={`${m.name}-${i}`} ch={m} />
                ))}
              </div>
              <span className={c.slotName}>
                {bestTeam.name} <GameTag label={bestTeam.gameShort} vent={bestTeam.vent} />
              </span>
            </section>
          )}
          {luckiest && (
            <section className={c.extra} style={{ '--slot-vent': luckiest.vent } as CSSProperties} aria-label="Luckiest pull">
              <span className={c.extraLabel}>Luckiest pull</span>
              <div className={c.luckRow}>
                <Portrait ch={luckiest} big />
                <span className={c.luckText}>
                  <span className={c.slotName}>{luckiest.name}</span>
                  <span>
                    {luckiest.topLabel} on pull <span className={c.statBig}>{formatNumber(luckiest.pulls)}</span>
                  </span>
                  <span className={c.verified} title="Proven from imported pull history">
                    ✔ From imported history · {formatDate(Date.parse(luckiest.time))}
                  </span>
                </span>
                <GameTag label={luckiest.gameShort} vent={luckiest.vent} />
              </div>
            </section>
          )}
        </div>
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
                {s.averagePity !== undefined ? (
                  <>
                    <span className={c.statSep} aria-hidden="true">
                      ·
                    </span>
                    {s.averagePity === null ? (
                      <span className={c.noData}>Average: no data yet</span>
                    ) : (
                      <>
                        <span className={c.statBig}>{formatNumber(Math.round(s.averagePity))}</span> average pity
                      </>
                    )}
                    <span className={c.statSep} aria-hidden="true">
                      ·
                    </span>
                    {(s.won ?? 0) + (s.lost ?? 0) > 0 ? (
                      <>
                        50/50 won <span className={c.statBig}>{formatNumber(s.won ?? 0)}</span> of {formatNumber((s.won ?? 0) + (s.lost ?? 0))} (
                        {Math.round(((s.won ?? 0) / ((s.won ?? 0) + (s.lost ?? 0))) * 100)}%)
                      </>
                    ) : (
                      <span className={c.noData}>50/50: no data yet</span>
                    )}
                  </>
                ) : (
                  s.tops > 0 && (
                    <>
                      <span className={c.statSep} aria-hidden="true">
                        ·
                      </span>
                      <span className={c.statBig}>{formatNumber(Math.round(s.total / s.tops))}</span> per {s.topLabel}
                    </>
                  )
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
