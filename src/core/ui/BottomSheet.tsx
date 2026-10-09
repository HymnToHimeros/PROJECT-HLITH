import { useEffect, useId, useRef, type ReactNode } from 'react';
import s from './ui.module.css';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** Phone sheet over a scrim. Escape or a tap on the scrim closes it. */
export function BottomSheet({ open, title, onClose, children }: Props) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      before?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className={s.scrim} onClick={onClose}>
      <div
        ref={ref}
        className={s.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <span className={s.grabber} aria-hidden="true" />
        <h2 id={titleId} className={s.sheetTitle}>
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
