import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppStatus } from './AppStatus';
import { resetAppShell, startAppShell } from './appShell';

describe('installed app notes (T45)', () => {
  afterEach(() => resetAppShell());

  it('shows nothing while online and up to date', () => {
    resetAppShell();
    const { container } = render(<AppStatus />);
    expect(container).toBeEmptyDOMElement();
  });

  it('says so while offline, and goes away when the connection is back', () => {
    resetAppShell();
    startAppShell({ register: false });
    render(<AppStatus />);
    act(() => void window.dispatchEvent(new Event('offline')));
    expect(screen.getByRole('status', { name: 'Offline' })).toHaveTextContent('Showing what this device has saved');
    act(() => void window.dispatchEvent(new Event('online')));
    expect(screen.queryByRole('status', { name: 'Offline' })).toBeNull();
  });

  it('offers a reload when a new version is ready', () => {
    resetAppShell({ updateReady: true });
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    render(<AppStatus />);
    expect(screen.getByRole('status', { name: 'Update ready' })).toHaveTextContent('A new version of HLITH is downloaded');
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(reload).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });
});
