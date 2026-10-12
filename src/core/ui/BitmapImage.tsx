import { useEffect, useRef, type CSSProperties } from 'react';

/**
 * A picture the user picked, already decoded (createImageBitmap), drawn on a canvas.
 * No address is made for the file, so nothing from it can reach the page as a URL or markup.
 * Sized like an <img>: its drawing size is the picture's own; CSS scales it.
 */
export function BitmapImage({ bitmap, label, className, style }: { bitmap: ImageBitmap; label?: string; className?: string | undefined; style?: CSSProperties }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    try {
      ref.current?.getContext('2d')?.drawImage(bitmap, 0, 0);
    } catch {
      /* no canvas here (tests) or the picture was closed */
    }
  }, [bitmap]);
  return (
    <canvas
      ref={ref}
      width={bitmap.width}
      height={bitmap.height}
      className={className}
      style={style}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    />
  );
}
