import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SignIn, TESTER_KEY } from './SignIn';

describe('SignIn', () => {
  beforeEach(() => localStorage.clear());

  it('Discord is open to everyone and comes first; Google and email are greyed out, not open to the public yet (T55)', () => {
    const onProvider = vi.fn(async () => null);
    render(<SignIn onProvider={onProvider} onEmail={async () => null} />);
    const buttons = screen.getAllByRole('button').map((b) => b.textContent);
    expect(buttons[0]).toBe('Continue with Discord');
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Discord' }));
    expect(onProvider).toHaveBeenCalledWith('discord');
    expect(screen.getByText('Not open to the public yet. Sign in with Discord.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeDisabled();
    expect(screen.getByLabelText('Email')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Email me a sign-in link' })).toBeDisabled();
  });

  it('“Owner or tester?” unlocks Google and the email link, and is remembered on this device', async () => {
    const onProvider = vi.fn(async () => null);
    const onEmail = vi.fn(async () => null);
    const { unmount } = render(<SignIn onProvider={onProvider} onEmail={onEmail} />);
    fireEvent.click(screen.getByRole('button', { name: 'Owner or tester? Use Google or email' }));
    expect(localStorage.getItem(TESTER_KEY)).toBe('1');
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));
    expect(onProvider).toHaveBeenCalledWith('google');
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.co' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Email me a sign-in link' }).closest('form') as HTMLFormElement);
    expect(await screen.findByRole('status')).toHaveTextContent('Check a@b.co');
    expect(onEmail).toHaveBeenCalledWith('a@b.co');
    unmount();
    render(<SignIn onProvider={onProvider} onEmail={onEmail} />);
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: /Owner or tester/ })).toBeNull();
  });

  it('shows the error instead of pretending it worked', async () => {
    render(<SignIn onProvider={async () => 'Provider is not enabled'} onEmail={async () => null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Discord' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Provider is not enabled');
  });

  it('links to About, Privacy and Terms with the fan notice', () => {
    render(<SignIn onProvider={async () => null} onEmail={async () => null} />);
    expect(screen.getByRole('link', { name: 'Privacy policy' })).toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('link', { name: 'Terms of service' })).toHaveAttribute('href', '/terms');
    expect(screen.getByText(/fan-made tool, not affiliated with HoYoverse/)).toBeInTheDocument();
  });
});
