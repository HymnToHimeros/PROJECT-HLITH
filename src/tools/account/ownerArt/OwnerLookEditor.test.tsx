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
});
