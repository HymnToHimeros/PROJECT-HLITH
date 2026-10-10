import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { known, unknown } from '../contract/known';
import {
  BannerCard,
  BottomSheet,
  CharacterTile,
  CurrencyChip,
  DragHandleRow,
  EmptyState,
  ProgressBar,
  Segmented,
  StatTile,
  Timer,
  UnverifiedTag,
} from './index';

afterEach(() => vi.useRealTimers());

describe('honest data', () => {
  it('a known stat shows its value', () => {
    render(<StatTile label="Stamina" value={known('212/240', 'hoyolab')} />);
    expect(screen.getByText('212/240')).toBeInTheDocument();
  });

  it('an unknown stat shows "No data yet" and the fix, never a number', () => {
    const { container } = render(<StatTile label="Stamina" value={unknown('connect-account')} />);
    expect(screen.getByText(/No data yet/)).toHaveTextContent('No data yet · Connect account');
    expect(container.textContent).not.toMatch(/\d/);
  });

  it('the fix becomes a button when there is a handler', () => {
    const onFix = vi.fn();
    render(<StatTile label="Stamina" value={unknown('connect-account')} onFix={onFix} />);
    fireEvent.click(screen.getByRole('button', { name: 'Connect account' }));
    expect(onFix).toHaveBeenCalledOnce();
  });

  it('an unknown progress bar draws no fill and no 0/total', () => {
    const { container } = render(<ProgressBar label="Materials" value={unknown()} />);
    expect(container.textContent).not.toMatch(/\d/);
    expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow');
  });

  it('a known progress bar shows done/total', () => {
    render(<ProgressBar label="Materials" value={known({ done: 12, total: 18 }, 'user')} />);
    expect(screen.getByText('12/18')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '67');
  });

  it('an unknown currency shows no amount', () => {
    const { container } = render(<CurrencyChip name="Premium currency" amount={unknown()} />);
    expect(container.textContent).toBe('Premium currencyNo data yet');
  });
});

describe('unverified data', () => {
  it('always shows its source', () => {
    render(<UnverifiedTag source="datamine · reliable" />);
    expect(screen.getByText('? UNVERIFIED')).toBeInTheDocument();
    expect(screen.getByText('datamine · reliable')).toBeInTheDocument();
  });

  it('a leaked banner shows the tag instead of a countdown', () => {
    render(<BannerCard kind="Character banner" title="Next unit" ends={Date.now() + 1e9} unverified={{ source: 'leak site' }} />);
    expect(screen.getByText('? UNVERIFIED')).toBeInTheDocument();
    expect(screen.queryByText(/ends in/)).toBeNull();
  });
});

describe('Timer', () => {
  it('turns urgent under 72 h on a deadline and ticks live under a day', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-09T00:00:00Z'));
    const to = Date.now() + 10_000;
    render(<Timer to={to} deadline />);
    const el = screen.getByText('00:00:10');
    expect(el.className).toMatch(/urgent/);
    act(() => vi.advanceTimersByTime(1_000));
    expect(screen.getByText('00:00:09')).toBeInTheDocument();
  });

  it('is not urgent when it counts to a start', () => {
    render(<Timer to={Date.now() + 3_600_000} />);
    expect(screen.getByText(/:/).className).not.toMatch(/urgent/);
  });
});

describe('CharacterTile', () => {
  const base = { name: 'Sample Hero', subtitle: 'Role · Element', rarity: 'top' as const, rarityLabel: '5★', elementColor: '#B98AF0' };
  it('shows dupes when owned', () => {
    render(<CharacterTile {...base} owned dupes="E2" />);
    expect(screen.getByText('E2')).toBeInTheDocument();
    expect(screen.getByText('SH')).toBeInTheDocument();
  });
  it('says NOT OWNED otherwise', () => {
    render(<CharacterTile {...base} owned={false} dupes="E2" />);
    expect(screen.getByText('NOT OWNED')).toBeInTheDocument();
    expect(screen.queryByText('E2')).toBeNull();
  });
});

describe('Segmented', () => {
  function Tabs() {
    const [v, setV] = useState<'a' | 'b' | 'c'>('a');
    const options = [
      { id: 'a' as const, label: 'Planner' },
      { id: 'b' as const, label: 'Calculator' },
      { id: 'c' as const, label: 'History' },
    ];
    return <Segmented label="Pulls" options={options} value={v} onChange={setV} />;
  }
  it('selects on click and moves with arrow keys, wrapping', () => {
    render(<Tabs />);
    fireEvent.click(screen.getByRole('tab', { name: 'Calculator' }));
    expect(screen.getByRole('tab', { name: 'Calculator' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Calculator' }), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'History' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'History' }), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Planner' })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('BottomSheet', () => {
  it('closes on Escape and on the scrim, not on the sheet', () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open title="More" onClose={onClose}>
        <p>inside</p>
      </BottomSheet>,
    );
    fireEvent.click(screen.getByText('inside'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.getByRole('dialog', { name: 'More' })).toBeInTheDocument();
  });
  it('typing in a field inside keeps the focus there, even when the owner re-renders with a new onClose', () => {
    // Owners often pass `onClose={() => …}`, a new function on every render. Each keystroke re-renders them.
    function Form() {
      const [text, setText] = useState('');
      return (
        <>
          <button type="button">Behind</button>
          <BottomSheet open title="Edit" onClose={() => setText('')}>
            <input aria-label="Name" value={text} onChange={(e) => setText(e.target.value)} />
          </BottomSheet>
        </>
      );
    }
    render(<Form />);
    const input = screen.getByLabelText('Name');
    input.focus();
    for (const v of ['a', 'ab', 'abc']) fireEvent.change(input, { target: { value: v } });
    expect(input).toHaveValue('abc');
    expect(document.activeElement).toBe(input);
  });
  it('renders nothing when closed', () => {
    render(<BottomSheet open={false} title="More" onClose={() => {}}>x</BottomSheet>);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('DragHandleRow', () => {
  it('hidden rows offer Restore, unavailable rows offer nothing', () => {
    const onRestore = vi.fn();
    const { rerender } = render(<DragHandleRow label="Backlog" state="hidden" onRestore={onRestore} />);
    fireEvent.click(screen.getByRole('button', { name: 'Restore Backlog' }));
    expect(onRestore).toHaveBeenCalledOnce();
    rerender(<DragHandleRow label="Future" state="not-available" />);
    expect(screen.getByText('Not available for this game yet')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });
  it('normal rows have a labelled handle and Hide', () => {
    render(<DragHandleRow label="Pulls" state="normal" onHide={() => {}} />);
    expect(screen.getByRole('button', { name: 'Move Pulls' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide Pulls' })).toBeInTheDocument();
  });
});

it('EmptyState has one action', () => {
  const onClick = vi.fn();
  render(<EmptyState title="No pull history yet" body="Import it." action={{ label: 'Import pull history', onClick }} />);
  expect(screen.getByText('NO DATA YET')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button'));
  expect(onClick).toHaveBeenCalledOnce();
});
