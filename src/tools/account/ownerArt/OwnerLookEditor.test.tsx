import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import OwnerLookEditor from './OwnerLookEditor';
import { DEFAULT_OWNER_STYLE } from './style';

describe('your owner look: grouped picker (T64)', () => {
  it('shows one tile per set; tapping a set with variants opens them, and a variant can be worn', () => {
    const onChange = vi.fn();
    render(<OwnerLookEditor value={DEFAULT_OWNER_STYLE} onChange={onChange} name="Odin" />);
    const frames = screen.getByRole('group', { name: 'Owner frame' });
    // Normal, Classic and the 8 sets.
    expect(within(frames).getAllByRole('button')).toHaveLength(10);
    const eclipse = within(frames).getByRole('button', { name: /Sól & Máni/ });
    expect(eclipse).toHaveAttribute('aria-expanded', 'false');
    expect(eclipse).toHaveTextContent('5 variants');
    fireEvent.click(eclipse);
    expect(eclipse).toHaveAttribute('aria-expanded', 'true');
    const variants = screen.getByRole('radiogroup', { name: 'Sól & Máni owner frame' });
    expect(within(variants).getAllByRole('radio')).toHaveLength(5);
    fireEvent.click(within(variants).getByRole('radio', { name: /C · Sköll & Hati/ }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ frame: 16, frameVariant: 2 }));
  });

  it('Classic opens the earlier styles; a set with one piece is picked straight from its tile', () => {
    const onChange = vi.fn();
    render(<OwnerLookEditor value={DEFAULT_OWNER_STYLE} onChange={onChange} name="Odin" />);
    const names = screen.getByRole('group', { name: 'Owner name style' });
    fireEvent.click(within(names).getByRole('button', { name: /Classic/ }));
    expect(within(screen.getByRole('radiogroup', { name: 'Classic owner name style' })).getAllByRole('radio')).toHaveLength(12);
    fireEvent.click(within(screen.getByRole('group', { name: 'Owner badge' })).getByRole('button', { name: /Gungnir/ }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ badge: 3 }));
  });

  it('“Wear full set” keeps the variant already chosen for that set', () => {
    const onChange = vi.fn();
    render(<OwnerLookEditor value={{ ...DEFAULT_OWNER_STYLE, frame: 16, frameVariant: 3 }} onChange={onChange} name="Odin" />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Wear full set' })[3] as HTMLElement);
    expect(onChange).toHaveBeenCalledWith({ badge: 4, frame: 16, name: 16, frameVariant: 3, nameVariant: 0 });
  });

  it('every set opens five frames and five name styles (T64 variants)', () => {
    const onChange = vi.fn();
    render(<OwnerLookEditor value={DEFAULT_OWNER_STYLE} onChange={onChange} name="Odin" />);
    // Role queries over the whole editor are slow (every tile carries art), and 16 rounds of them
    // passed 5 s on a busy CI runner. So each group's tiles are found once, and each open panel is
    // reached through the tile's aria-controls and queried on its own.
    for (const [group, kind] of [['Owner frame', 'owner frame'], ['Owner name style', 'owner name style']] as const) {
      const tiles = within(screen.getByRole('group', { name: group })).getAllByRole('button');
      for (const set of ['Draupnir', 'Geri & Freki', 'Gungnir', 'Sól & Máni', 'Nine Realms', 'Urnes Serpent', 'Valhalla', 'Gjallarhorn']) {
        const tile = tiles.find((t) => t.textContent?.includes(set));
        expect(tile, `${set} ${kind} tile`).toBeDefined();
        fireEvent.click(tile as HTMLElement);
        expect(tile).toHaveAttribute('aria-expanded', 'true');
        const panel = document.getElementById(tile?.getAttribute('aria-controls') ?? '') as HTMLElement;
        const variants = within(panel).getByRole('radiogroup');
        expect(variants).toHaveAttribute('aria-label', `${set} ${kind}`);
        expect(within(variants).getAllByRole('radio'), `${set} ${kind}`).toHaveLength(5);
        fireEvent.click(within(panel).getByRole('button', { name: 'Done' }));
        expect(tile).toHaveAttribute('aria-expanded', 'false');
      }
    }
    fireEvent.click(within(screen.getByRole('group', { name: 'Owner name style' })).getByRole('button', { name: /Valhalla/ }));
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Valhalla owner name style' })).getAllByRole('radio')[2] as HTMLElement);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ name: 19, nameVariant: 2 }));
  });
});
