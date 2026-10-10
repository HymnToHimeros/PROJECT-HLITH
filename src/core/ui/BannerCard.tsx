import { initials } from './CharacterTile';
import { cx } from './cx';
import { GameTag, UnverifiedTag } from './Tags';
import { Timer } from './Timer';
import s from './ui.module.css';

interface Props {
  kind: string; // 'Character warp'
  title: string;
  ends: number;
  art?: string | undefined;
  tag?: { label: string; vent: string } | undefined;
  /** Leaked banner: dashed and marked with its source. */
  unverified?: { source: string } | undefined;
}

export function BannerCard({ kind, title, ends, art, tag, unverified }: Props) {
  return (
    <div className={cx(s.banner, unverified && s.leak)}>
      <div className={s.bannerArt}>{art ? <img src={art} alt="" /> : initials(title)}</div>
      <div className={s.bannerBody}>
        <span className={s.bannerKind}>
          {kind}
          {tag && <GameTag {...tag} />}
        </span>
        <span className={s.bannerTitle} title={title}>
          {title}
        </span>
        {unverified ? <UnverifiedTag source={unverified.source} /> : <Timer to={ends} deadline prefix="ends in" />}
      </div>
    </div>
  );
}
