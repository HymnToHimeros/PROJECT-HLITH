import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { BottomSheet, Button, HowTo } from '../../core/ui';
import {
  applyKey,
  BANNER_RATIO,
  fillView,
  fitScale,
  fitView,
  hasGaps,
  initialView,
  keyAction,
  MAX_ZOOM,
  moveBy,
  OUTPUT_SIZE,
  placement,
  ZOOM_STEP,
  zoomBy,
  zoomFromLevel,
  zoomLevel,
  zoomTo,
  fillScale,
  type ImageKind,
  type Size,
  type View,
} from './imageCrop';
import { renderCrop } from './imageRender';
import a from './imageAdjust.module.css';

interface Props {
  kind: ImageKind;
  /** The picture you picked (or the saved one). Kept in memory only while this is open. */
  source: Blob;
  /** What shows in any gap after "Fit": the default banner wash, or the plain picture background. */
  background: string;
  /** The default banner wash, for the preview when there's no banner. */
  bannerBackground: string;
  /** The other picture as it is now (the banner while adjusting the picture, and the other way round). */
  other: string | null;
  name: string;
  onCancel: () => void;
  onSave: (dataUrl: string) => void;
}

const TITLE: Record<ImageKind, string> = { avatar: 'Adjust picture', banner: 'Adjust banner' };
const STAGE_PAD = 24;
const AVATAR_FRAME_MAX = 280;

interface Loaded {
  bitmap: ImageBitmap;
  url: string;
  size: Size;
}

/** Shows `url` placed exactly as `view` says, inside a box `width` CSS pixels wide (the box sets the shape). */
function Placed({ url, img, out, view, width, className }: { url: string; img: Size; out: Size; view: View; width: number; className: string | undefined }) {
  const k = width / out.w;
  const p = placement(img, out, view);
  return <img src={url} alt="" draggable={false} className={className} style={{ left: p.x * k, top: p.y * k, width: p.w * k, height: p.h * k }} />;
}

/**
 * Adjust picture / banner: the picture inside its exact final shape with the
 * outside dimmed. Drag, pinch, wheel, slider, buttons or keys to place it; Save
 * draws exactly that to the saved size.
 */
export function ImageAdjust({ kind, source, background, bannerBackground, other, name, onCancel, onSave }: Props) {
  const out = OUTPUT_SIZE[kind];
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState('');
  const [view, setView] = useState<View | null>(null);
  const [stageW, setStageW] = useState(0);
  const [busy, setBusy] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());

  // Read the picture once. The original stays only in this browser tab's memory.
  useEffect(() => {
    let alive = true;
    let made: Loaded | null = null;
    createImageBitmap(source).then(
      (bitmap) => {
        if (!alive) return bitmap.close();
        made = { bitmap, url: URL.createObjectURL(source), size: { w: bitmap.width, h: bitmap.height } };
        setLoaded(made);
        setView(initialView(made.size, out));
      },
      () => alive && setError('That picture couldn’t be read. Try another file.'),
    );
    return () => {
      alive = false;
      if (made) {
        made.bitmap.close();
        URL.revokeObjectURL(made.url);
      }
    };
  }, [source, out]);

  // The frame follows the sheet's width (phone or PC).
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => setStageW(el.clientWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [loaded]);

  const avail = Math.max(120, (stageW || 320) - STAGE_PAD * 2);
  const frameW = kind === 'avatar' ? Math.min(AVATAR_FRAME_MAX, avail) : avail;
  const frameH = kind === 'avatar' ? frameW : frameW / BANNER_RATIO;
  const k = frameW / out.w; // CSS pixels per output pixel

  const img = loaded?.size;
  const update = useCallback((fn: (v: View, img: Size) => View) => setView((v) => (v && img ? fn(v, img) : v)), [img]);

  /** A point on screen → output pixels from the frame's top-left. */
  const toFrame = (clientX: number, clientY: number) => {
    const r = frameRef.current?.getBoundingClientRect();
    return r ? { x: (clientX - r.left) / k, y: (clientY - r.top) / k } : undefined;
  };

  // Mouse wheel / trackpad pinch zooms around the pointer (needs a non-passive listener to stop the page scrolling).
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = frameRef.current?.getBoundingClientRect();
      const anchor = r ? { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k } : undefined;
      update((v, i) => zoomBy(i, out, v, Math.exp(-e.deltaY * 0.0015), anchor));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [k, out, update]);

  const pinch = () => {
    const [p1, p2] = [...pointers.current.values()];
    return p1 && p2 ? { d: Math.hypot(p1.x - p2.x, p1.y - p2.y), x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 } : null;
  };
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    frameRef.current?.focus({ preventScroll: true });
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const before = pinch();
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const after = pinch();
    if (before && after && before.d > 0) {
      const anchor = toFrame(after.x, after.y);
      const dx = (after.x - before.x) / k;
      const dy = (after.y - before.y) / k;
      update((v, i) => zoomBy(i, out, moveBy(i, out, v, dx, dy), after.d / before.d, anchor));
    } else if (pointers.current.size === 1) {
      const dx = (e.clientX - prev.x) / k;
      const dy = (e.clientY - prev.y) / k;
      update((v, i) => moveBy(i, out, v, dx, dy));
    }
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const action = keyAction(e.key, e.shiftKey);
    if (!action) return;
    e.preventDefault();
    update((v, i) => applyKey(i, out, v, action));
  };

  const save = () => {
    if (!loaded || !view) return;
    setBusy(true);
    try {
      onSave(renderCrop(loaded.bitmap, loaded.size, kind, view).dataUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That picture couldn’t be saved. Try another file.');
      setBusy(false);
    }
  };

  const level = img && view ? zoomLevel(img, out, view) : 1;
  const minLevel = img && view?.mode === 'fit' ? Math.min(1, fitScale(img, out) / fillScale(img, out)) : 1;
  const gaps = img && view ? hasGaps(img, out, view) : false;
  const what = kind === 'avatar' ? 'picture' : 'banner';
  const pct = `${Math.round(level * 100)}%`;

  // Live preview sizes (CSS pixels): a small copy of the profile header.
  const pW = Math.min(320, Math.max(200, stageW || 320));
  const pInner = pW - 2; // inside the 1px border
  const pBannerH = pInner / BANNER_RATIO;
  const pAvatar = 56;
  const previewBanner =
    kind === 'banner' && loaded && view ? (
      <Placed url={loaded.url} img={loaded.size} out={out} view={view} width={pInner} className={a.img} />
    ) : other ? (
      <img src={other} alt="" className={a.cover} />
    ) : null;
  const previewAvatar =
    kind === 'avatar' && loaded && view ? (
      <Placed url={loaded.url} img={loaded.size} out={out} view={view} width={pAvatar - 6} className={a.img} />
    ) : other ? (
      <img src={other} alt="" className={a.cover} />
    ) : (
      name.charAt(0).toUpperCase() || '?'
    );

  return (
    <BottomSheet open title={TITLE[kind]} subtitle={kind === 'avatar' ? 'Round, as it shows on your profile' : 'Wide strip, as it shows on your profile'} onClose={onCancel} closeButton>
      <div className={a.body}>
        <div
          ref={stageRef}
          className={a.stage}
          style={{ height: frameH + STAGE_PAD * 2 }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {loaded && view ? (
            <div
              ref={frameRef}
              className={`${a.frame} ${kind === 'avatar' ? a.round : a.wide}`}
              style={{ width: frameW, height: frameH, background } as CSSProperties}
              tabIndex={0}
              role="application"
              aria-roledescription="picture position"
              aria-label={`${TITLE[kind]}: drag or use the arrow keys to move, plus and minus to zoom, 0 to reset`}
              aria-describedby={`adjust-status-${kind}`}
              onKeyDown={onKeyDown}
            >
              <Placed url={loaded.url} img={loaded.size} out={out} view={view} width={frameW} className={a.img} />
            </div>
          ) : (
            !error && <span className={a.loading}>Loading the {what}…</span>
          )}
        </div>

        <p id={`adjust-status-${kind}`} className={a.hint} aria-live="polite">
          Zoom {pct} · {view?.mode === 'fit' ? 'Fit: the whole picture shows' : 'Fill: the frame is covered'}
          {gaps ? '. Edges with no picture show the default background.' : '.'}
        </p>

        <div className={a.zoomRow}>
          <span className={a.zoomLabel} id={`zoom-label-${kind}`}>
            Zoom
          </span>
          <Button className={a.round44} aria-label="Zoom out" disabled={!view || level <= minLevel + 1e-6} onClick={() => update((v, i) => zoomBy(i, out, v, 1 / ZOOM_STEP))}>
            −
          </Button>
          <input
            type="range"
            className={a.slider}
            aria-labelledby={`zoom-label-${kind}`}
            aria-valuetext={pct}
            min={minLevel}
            max={MAX_ZOOM}
            step={0.01}
            value={level}
            disabled={!view}
            onChange={(e) => {
              const next = Number(e.target.value);
              update((v, i) => zoomTo(i, out, v, zoomFromLevel(i, out, next)));
            }}
          />
          <Button className={a.round44} aria-label="Zoom in" disabled={!view || level >= MAX_ZOOM - 1e-6} onClick={() => update((v, i) => zoomBy(i, out, v, ZOOM_STEP))}>
            +
          </Button>
          <span className={a.value} aria-hidden="true">
            {pct}
          </span>
        </div>

        <div className={a.modes} role="group" aria-label="Size">
          <Button className={view?.mode === 'fill' ? a.on : undefined} aria-pressed={view?.mode === 'fill'} disabled={!view} onClick={() => update((v, i) => fillView(i, out, v))}>
            Fill
          </Button>
          <Button className={view?.mode === 'fit' ? a.on : undefined} aria-pressed={view?.mode === 'fit'} disabled={!view} onClick={() => update((_v, i) => fitView(i, out))}>
            Fit
          </Button>
          <Button disabled={!view} onClick={() => update((_v, i) => initialView(i, out))}>
            Reset
          </Button>
        </div>

        <div className={a.previewWrap}>
          <span className={a.previewLabel}>Preview on your profile</span>
          <div className={a.preview} style={{ width: pW }} aria-hidden="true">
            <div className={a.pBanner} style={{ height: pBannerH, background: bannerBackground }}>
              {previewBanner}
            </div>
            <div className={a.pRow}>
              <span className={a.pAvatar} style={{ width: pAvatar, height: pAvatar }}>
                {previewAvatar}
              </span>
              <span className={a.pName}>{name || 'Your profile'}</span>
            </div>
          </div>
        </div>

        {error && (
          <p className={a.warn} role="alert">
            {error}
          </p>
        )}

        <div className={a.actions}>
          <Button variant="primary" onClick={save} disabled={!view || busy}>
            {busy ? 'Saving…' : `Use this ${what}`}
          </Button>
          <Button onClick={onCancel}>Cancel</Button>
        </div>

        <HowTo
          title={`How to adjust the ${what}`}
          steps={[
            'Drag the picture to move it. On a phone, pinch with two fingers to zoom; on a PC, use the mouse wheel.',
            'Or use the Zoom slider and the − and + buttons. With the frame focused, the arrow keys move it (hold Shift for bigger steps), + and − zoom and 0 resets.',
            '“Fill” covers the whole frame, so nothing is left empty. “Fit” shows the whole picture; any empty edges show the default background.',
            `What’s inside the bright ${kind === 'avatar' ? 'circle' : 'strip'} is exactly what shows on your profile. The dimmed part is cut off.`,
            `“Use this ${what}” puts it on your profile draft. Press “Save profile” afterwards to keep it. Your original file is never stored, only the part you chose.`,
          ]}
        />
      </div>
    </BottomSheet>
  );
}

