import type { ButtonHTMLAttributes } from 'react';
import { cx } from './cx';
import s from './ui.module.css';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'quiet' };

/** Primary = vent fill (one main action per area). Quiet = text link style. */
export function Button({ variant = 'secondary', className, type = 'button', ...rest }: Props) {
  return (
    <button
      type={type}
      className={cx(s.button, variant === 'primary' && s.primary, variant === 'quiet' && s.quiet, className)}
      {...rest}
    />
  );
}
