import type { ReactNode } from 'react';
import s from './ui.module.css';

/**
 * "How to use this": every feature explains itself where it lives.
 * Numbered steps, collapsed by default, same look everywhere.
 */
export function HowTo({ title = 'How to use this', steps, children, open = false }: { title?: string; steps: ReactNode[]; children?: ReactNode; open?: boolean }) {
  return (
    <details className={s.howTo} open={open}>
      <summary className={s.howToTitle}>{title}</summary>
      <ol className={s.howToSteps}>
        {steps.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
      {children && <div className={s.howToNote}>{children}</div>}
    </details>
  );
}
