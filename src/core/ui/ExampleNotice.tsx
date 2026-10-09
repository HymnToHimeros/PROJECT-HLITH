import type { ReactNode } from 'react';
import { Button } from './Button';
import { useMarkSample } from './sampleMarker';
import { ExampleTag } from './Tags';
import s from './ui.module.css';

export interface ExampleAction {
  label: string;
  onClick: () => void;
}

/**
 * Shown on top of a screen whenever example data is on it. Always says what to
 * do to replace it, with a button that goes straight there.
 */
export function ExampleNotice({ children, actions = [] }: { children: ReactNode; actions?: ExampleAction[] }) {
  useMarkSample();
  return (
    <div className={s.exampleNotice} role="note">
      <ExampleTag />
      <span className={s.exampleText}>Example data, not yours. {children}</span>
      {actions.length > 0 && (
        <span className={s.exampleActions}>
          {actions.map((a) => (
            <Button key={a.label} variant="primary" onClick={a.onClick}>
              {a.label}
            </Button>
          ))}
        </span>
      )}
    </div>
  );
}
