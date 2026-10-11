import { useCallback, useEffect, useRef, useState } from 'react';
import { cx } from '../../core/ui/cx';
import { coverFocusY } from './artFit';
import b from './banners.module.css';

/**
 * Banner art that fits its frame on its own. Character art is cropped (cover) with the face
 * in view, worked out from the picture's real size and the frame's (artFit.ts), again when the
 * frame changes size. Weapon art (W-Engines, Light Cones) is never cropped: the whole picture
 * shows (contain) over a blurred copy of itself, so the frame has no empty bands.
 */
export function BannerArt({ src, weapon, className }: { src: string; weapon: boolean; className?: string }) {
  const ref = useRef<HTMLImageElement>(null);
  const [y, setY] = useState<number | null>(null);

  const place = useCallback(() => {
    const img = ref.current;
    if (!img || weapon || !img.naturalWidth) return;
    setY(coverFocusY({ w: img.naturalWidth, h: img.naturalHeight }, { w: img.clientWidth, h: img.clientHeight }));
  }, [weapon]);

  useEffect(() => {
    const img = ref.current;
    if (!img || weapon) return;
    if (img.complete) place();
    if (typeof ResizeObserver === 'undefined') return;
    const watch = new ResizeObserver(place);
    watch.observe(img);
    return () => watch.disconnect();
  }, [place, weapon, src]);

  if (weapon) {
    return (
      <>
        <img src={src} alt="" loading="lazy" aria-hidden="true" className={b.artBackdrop} />
        <img src={src} alt="" loading="lazy" className={cx(className, b.artWhole)} />
      </>
    );
  }
  return <img ref={ref} src={src} alt="" loading="lazy" onLoad={place} className={cx(className, b.artCover)} style={y === null ? undefined : { objectPosition: `50% ${y}%` }} />;
}
