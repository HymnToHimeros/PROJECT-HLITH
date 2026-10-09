import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SignIn } from './SignIn';

describe('SignIn', () => {
  it('offers Google, Discord and an email link', async () => {
    const onProvider = vi.fn(async () => null);
    const onEmail = vi.fn(async () => null);
    render(<SignIn onProvider={onProvider} onEmail={onEmail} />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Discord' }));
    expect(onProvider).toHaveBeenCalledWith('discord');
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.co' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Email me a sign-in link' }).closest('form') as HTMLFormElement);
    expect(await screen.findByRole('status')).toHaveTextContent('Check a@b.co');
    expect(onEmail).toHaveBeenCalledWith('a@b.co');
  });

  it('shows the error instead of pretending it worked', async () => {
    render(<SignIn onProvider={async () => 'Provider is not enabled'} onEmail={async () => null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Provider is not enabled');
  });
});
