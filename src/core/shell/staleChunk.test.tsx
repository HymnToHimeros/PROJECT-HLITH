import { act, fireEvent, render, screen } from '@testing-library/react';
import { lazy, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LazyArea } from './LazyArea';
import { onStaleChunk } from './staleChunk';

describe('a screen file from an older release (stale chunk)', () => {
  const setup = (start = 1_000_000) => {
    let now = start;
    let stored: string | null = null;
    const reload = vi.fn();
    const deps = { now: () => now, read: () => stored, write: (v: string) => void (stored = v), reload };
    const fire = () => {
      const e = new Event('vite:preloadError', { cancelable: true });
      return { handled: onStaleChunk(e, deps), prevented: e.defaultPrevented };
    };
    return { fire, reload, later: (ms: number) => void (now += ms) };
  };

  it('reloads once to get the new release, and never loops', () => {
    const { fire, reload, later } = setup();
    expect(fire()).toEqual({ handled: true, prevented: true });
    expect(reload).toHaveBeenCalledTimes(1);
    later(5_000);
    expect(fire()).toEqual({ handled: false, prevented: false }); // still broken right after: show the card instead
    expect(reload).toHaveBeenCalledTimes(1);
    later(60_000);
    expect(fire().handled).toBe(true); // a later release, much later: reload again
    expect(reload).toHaveBeenCalledTimes(2);
  });
});

describe('LazyArea', () => {
  it('shows Loading…, then a Reload card instead of a blank page when the screen fails to load, and tries again on another screen', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined); // React logs the caught error
    const Broken = lazy(() => Promise.reject(new TypeError('Failed to fetch dynamically imported module')));
    const Fine = lazy(async () => ({ default: () => <p>Today screen</p> }));
    function Host() {
      const [which, setWhich] = useState<'broken' | 'fine'>('broken');
      return (
        <>
          <button type="button" onClick={() => setWhich('fine')}>
            Other screen
          </button>
          <LazyArea resetKey={which}>{which === 'broken' ? <Broken /> : <Fine />}</LazyArea>
        </>
      );
    }
    render(<Host />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    const card = await screen.findByRole('alert');
    expect(card).toHaveTextContent('This part of HLITH didn’t load.');
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Other screen' })));
    expect(await screen.findByText('Today screen')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    vi.restoreAllMocks();
  });
});
