import { memo } from 'react';
import type { OwnerTheme } from './ownerThemes';
import a from './art.module.css';
import { OrnamentLayers } from './ornaments';
import { useSkinPack } from './skinPack';
import './skins.css';

/**
 * An owner theme's background (T47): the owner's own picture filling the art layer behind the
 * page, or nothing until one is uploaded. It comes from the private bucket as a blob: link
 * (ownerThemes.ts); nothing here names or holds it. A gold frame is drawn on top when
 * the theme asks for it. Fixed behind the page, never takes clicks.
 */
export const OwnerArt = memo(function OwnerArt({ theme }: { theme: OwnerTheme }) {
  const src = theme.pictureUrl;
  const pack = useSkinPack(theme.look?.pack);
  return (
    <div className={`${a.art} ${a.ownerArt}`} aria-hidden="true" data-art="owner">
      {src && <img className={a.ownerPicture} src={src} alt="" decoding="async" />}
      <OrnamentLayers ids={theme.ornaments} />
      {(src || !pack?.scene.length) && <span className={a.ownerScrim} />}
      {pack?.scene.map((l, i) => (
        // Cleaned by svgClean.ts: drawing elements only, no scripts, links or styles.
        <div key={i} className="sk-layer" data-place={l.place} style={{ opacity: l.opacity }} dangerouslySetInnerHTML={{ __html: l.markup }} />
      ))}
      {theme.ornaments.includes('gold-frame') && (
        <svg className={a.ownerFrame} viewBox="0 0 100 100" preserveAspectRatio="none">
          <rect x="1.2" y="1.2" width="97.6" height="97.6" rx="1.5" vectorEffect="non-scaling-stroke" strokeWidth="3" />
          <rect x="2.6" y="2.6" width="94.8" height="94.8" rx="1" vectorEffect="non-scaling-stroke" strokeWidth="1" />
        </svg>
      )}
    </div>
  );
});
