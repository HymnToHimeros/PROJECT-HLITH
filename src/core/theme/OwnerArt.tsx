import { memo } from 'react';
import type { OwnerTheme } from './ownerThemes';
import a from './art.module.css';

/**
 * An owner theme's background (T47): the owner's own picture, else the theme's drawn scene,
 * filling the art layer behind the page. Both come from the private bucket as blob: links
 * (ownerThemes.ts); nothing here names or holds any of them. A gold frame is drawn on top when
 * the theme asks for it. Fixed behind the page, never takes clicks.
 */
export const OwnerArt = memo(function OwnerArt({ theme }: { theme: OwnerTheme }) {
  const src = theme.pictureUrl ?? theme.sceneUrl;
  return (
    <div className={`${a.art} ${a.ownerArt}`} aria-hidden="true" data-art="owner">
      {src && <img className={a.ownerPicture} src={src} alt="" decoding="async" />}
      <span className={a.ownerScrim} />
      {theme.ornaments.includes('gold-frame') && (
        <svg className={a.ownerFrame} viewBox="0 0 100 100" preserveAspectRatio="none">
          <rect x="1.2" y="1.2" width="97.6" height="97.6" rx="1.5" vectorEffect="non-scaling-stroke" strokeWidth="3" />
          <rect x="2.6" y="2.6" width="94.8" height="94.8" rx="1" vectorEffect="non-scaling-stroke" strokeWidth="1" />
        </svg>
      )}
    </div>
  );
});
