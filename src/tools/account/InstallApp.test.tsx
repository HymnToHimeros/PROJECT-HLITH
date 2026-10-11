import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetAppShell, startAppShell } from '../../core/shell/appShell';
import { InstallApp, platformOf } from './InstallApp';
import { setupSteps } from './SetupChecklist';

describe('Install HLITH as an app (T45)', () => {
  afterEach(() => resetAppShell());

  it('tells the device from the browser', () => {
    expect(platformOf('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit Safari')).toBe('iphone');
    expect(platformOf('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit Safari', 5)).toBe('iphone'); // iPad
    expect(platformOf('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit Safari', 0)).toBe('pc');
    expect(platformOf('Mozilla/5.0 (Linux; Android 15; Pixel 9) Chrome/140 Mobile')).toBe('android');
    expect(platformOf('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140')).toBe('pc');
  });

  it('iPhone: the Safari steps open, the other devices folded away', () => {
    resetAppShell();
    render(<InstallApp platform="iphone" />);
    const card = screen.getByRole('region', { name: 'Install HLITH as an app' });
    expect(card).toHaveTextContent('Add to Home Screen');
    expect(screen.getByText('How to install: iPhone or iPad (Safari)').closest('details')).toHaveAttribute('open');
    expect(screen.getByText('Android (Chrome)').closest('details')).not.toHaveAttribute('open');
    expect(screen.queryByRole('button', { name: 'Install app' })).toBeNull(); // Safari has no install dialog
  });

  it('Chrome: a real Install button from the browser offer', async () => {
    resetAppShell();
    startAppShell({ register: false });
    render(<InstallApp platform="android" />);
    const offer = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt: vi.fn(async () => undefined), userChoice: Promise.resolve({ outcome: 'dismissed' as const }) });
    act(() => void window.dispatchEvent(offer));
    expect(offer.defaultPrevented).toBe(true); // our button, not the browser's mini bar
    fireEvent.click(screen.getByRole('button', { name: 'Install app' }));
    expect(offer.prompt).toHaveBeenCalledOnce();
    expect(await screen.findByText(/Not installed\. You can install it any time/)).toBeInTheDocument();
  });

  it('is hidden once installed, and the setup step ticks itself', () => {
    resetAppShell({ installed: true });
    const { container } = render(<InstallApp platform="pc" />);
    expect(container).toBeEmptyDOMElement();
    const act0 = { games: [], open: vi.fn(), goTo: vi.fn() };
    const facts = { accounts: [], feed: false, backup: false, server: false };
    expect(setupSteps([], {}, {}, facts, act0).find((s) => s.id === 'install')?.done).toBe(false);
    expect(setupSteps([], {}, {}, { ...facts, installed: true }, act0).find((s) => s.id === 'install')?.done).toBe(true);
  });
});
