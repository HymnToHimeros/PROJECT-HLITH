import { useEffect, useEffectEvent, useId, useRef, type ReactNode } from 'react';
import { cx } from './cx';
import s from './ui.module.css';

type Placement = 'bottom' | 'side' | 'center' | 'left';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** On PC (≥ 820 px) dock to the right as a side panel instead of a bottom sheet. Same as placement="side". */
  side?: boolean;
  /**
   * Where it sits on PC (≥ 820 px). Phones always get a bottom sheet.
   * bottom (default) · side: right panel · center: centred card (the design's sheets) · left: over the sidebar (Edit layout).
   */
  placement?: Placement;
  /** Line under the title. */
  subtitle?: ReactNode;
  /** Shown before the title (e.g. the account avatar). */
  leading?: ReactNode;
  /** Right side of the header. Defaults to a ✕ close button when `closeButton` is on. */
  headerAction?: ReactNode;
  /** Show the design's ✕ button in the header. */
  closeButton?: boolean;
  /** Keep the title for screen readers only (the content draws its own header). */
  hideTitle?: boolean;
}

/** Sheet over a scrim. Escape or a tap on the scrim closes it. */
export function BottomSheet({ open, title, onClose, children, side = false, placement, subtitle, leading, headerAction, closeButton = false, hideTitle = false }: Props) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const where: Placement = placement ?? (side ? 'side' : 'bottom');

  // The latest onClose, read when Escape is pressed. Callers often pass a new function on every render; if the effect
  // below depended on it, each keystroke in a field inside would re-run it and pull the focus out of the field.
  const closeNow = useEffectEvent(() => onClose());

  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeNow();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      before?.focus();
    };
  }, [open]);

  if (!open) return null;
  const action =
    headerAction ??
    (closeButton ? (
      <button type="button" className={s.sheetClose} onClick={onClose} aria-label="Close">
        ✕
      </button>
    ) : null);
  const fancy = Boolean(subtitle || leading || action);
  return (
    <div className={cx(s.scrim, where === 'side' && s.scrimSide, where === 'center' && s.scrimCenter, where === 'left' && s.scrimLeft)} onClick={onClose}>
      <div
        ref={ref}
        className={cx(s.sheet, where === 'side' && s.sheetSide, where === 'center' && s.sheetCenter, where === 'left' && s.sheetLeft)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <span className={s.grabber} aria-hidden="true" />
        {hideTitle ? (
          <h2 id={titleId} className="visually-hidden">
            {title}
          </h2>
        ) : fancy ? (
          <div className={s.sheetHead}>
            {leading}
            <div className={s.sheetHeadText}>
              <h2 id={titleId} className={s.sheetTitle}>
                {title}
              </h2>
              {subtitle && <span className={s.sheetSub}>{subtitle}</span>}
            </div>
            {action}
          </div>
        ) : (
          <h2 id={titleId} className={s.sheetTitle}>
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>
  );
}
