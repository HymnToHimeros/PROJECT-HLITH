import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { rememberTester, SignIn, TESTER_KEY } from './SignIn';

describe('SignIn', () => {
  beforeEach(() => localStorage.clear());

  it('Discord comes first, Google is open to everyone; email is greyed out, not open to the public yet (T55)', async () => {
    const onProvider = vi.fn(async () => null);
    render(<SignIn onProvider={onProvider} onEmail={async () => null} />);
    const buttons = screen.getAllByRole('button').map((b) => b.textContent);
    expect(buttons.slice(0, 2)).toEqual(['Continue with Discord', 'Continue with Google']);
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Discord' }));
    expect(onProvider).toHaveBeenCalledWith('discord');
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));
    expect(onProvider).toHaveBeenCalledWith('google');
    expect(screen.getByText('Email sign-in isn’t open to the public yet. Use Discord or Google.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Email me a sign-in link' })).toBeDisabled();
  });

  it('“Owner or tester?” unlocks the email link, and is remembered on this device', async () => {
    const onProvider = vi.fn(async () => null);
    const onEmail = vi.fn(async () => null);
    const { unmount } = render(<SignIn onProvider={onProvider} onEmail={onEmail} />);
    fireEvent.click(screen.getByRole('button', { name: 'Owner or tester? Use email' }));
    expect(localStorage.getItem(TESTER_KEY)).toBe('1');
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.co' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Email me a sign-in link' }).closest('form') as HTMLFormElement);
    expect(await screen.findByRole('status')).toHaveTextContent('Check a@b.co');
    expect(onEmail).toHaveBeenCalledWith('a@b.co');
    unmount();
    render(<SignIn onProvider={onProvider} onEmail={onEmail} />);
    expect(screen.getByLabelText('Email')).toBeEnabled();
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

  it('an invite link says so and opens email sign-in too (T60)', () => {
    render(<SignIn onProvider={async () => null} onEmail={async () => null} invited />);
    expect(screen.getByRole('status')).toHaveTextContent('You’ve been invited to test HLIÐSKJÁLF.');
    expect(screen.getByLabelText('Email')).toBeEnabled();
  });

  it('signed in, the server’s answer decides whether this device keeps email sign-in (T60)', () => {
    rememberTester(true);
    expect(localStorage.getItem(TESTER_KEY)).toBe('1');
    rememberTester(false);
    expect(localStorage.getItem(TESTER_KEY)).toBeNull();
  });
});
