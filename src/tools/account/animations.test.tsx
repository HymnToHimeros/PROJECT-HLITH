import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemePage } from './sections';
import { CountUp } from '../../core/ui/CountUp';
import { getPrefs, reloadPrefs } from '../../core/data/prefs';
import { applyMotion, motionFor, setMotion } from '../../core/theme/motion';

const device = (reduce: boolean) =>
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: reduce && q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} }));

describe('animations: on, reduced or off (T50)', () => {
  beforeEach(() => {
    localStorage.clear();
    reloadPrefs();
    delete document.documentElement.dataset.motion;
  });
  afterEach(() => vi.unstubAllGlobals());

  it('not chosen = follows the device; a choice wins over the device', () => {
    device(false);
    expect(motionFor(undefined)).toBe('on');
    device(true);
    expect(motionFor(undefined)).toBe('reduced');
    expect(motionFor('on')).toBe('on');
    expect(motionFor('nonsense')).toBe('reduced');
    applyMotion('off');
    expect(document.documentElement.dataset.motion).toBe('off');
  });

  it('Account → Theme → Animations saves the choice, and “Follow my device” clears it', () => {
    device(false);
    render(<ThemePage />);
    const group = screen.getByRole('tablist', { name: 'Animations' });
    expect(screen.getByRole('tab', { name: 'On' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Following your device’s setting for now.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Off' }));
    expect(getPrefs().motion).toBe('off');
    expect(document.documentElement.dataset.motion).toBe('off');
    expect(group).toBeInTheDocument();
    expect(screen.getByText('Nothing moves at all.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Follow my device' }));
    expect(getPrefs().motion).toBeUndefined();
    expect(document.documentElement.dataset.motion).toBe('on');
  });

  it('numbers tick up only with animations on, and always carry the real value', () => {
    setMotion('reduced');
    const { unmount } = render(<CountUp>{'1,240'}</CountUp>);
    expect(screen.getByText('1,240')).toBeInTheDocument();
    unmount();

    setMotion('on');
    let frame: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => ((frame = cb), 1));
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    render(<CountUp>{'1,240'}</CountUp>);
    expect(screen.getByText('0')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('1,240')).toHaveClass('visually-hidden');
    act(() => frame?.(performance.now() + 10_000)); // finished
    expect(screen.getByText('1,240')).not.toHaveClass('visually-hidden');
    // Anything that isn't a plain whole number shows as it is.
    render(<CountUp>{'12/18'}</CountUp>);
    expect(screen.getByText('12/18')).toBeInTheDocument();
  });
});
