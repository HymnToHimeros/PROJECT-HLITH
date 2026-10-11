import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LEGAL_VERSIONS } from '../../../config/legal/versions';
import { type Gate, type GateApi } from '../../core/auth/gate';
import { UsernameCard } from './UsernameCard';

const gate = (over: Partial<Gate> = {}): Gate => ({
  termsVersion: LEGAL_VERSIONS.terms,
  privacyVersion: LEGAL_VERSIONS.privacy,
  termsOk: false,
  privacyOk: false,
  username: null,
  nextChangeAt: null,
  suggested: null,
  accepted: false,
  ...over,
});

function fakeApi(over: Partial<GateApi> = {}): GateApi & { [k in keyof GateApi]: ReturnType<typeof vi.fn> } {
  return {
    load: vi.fn(async () => gate()),
    status: vi.fn(async (name: string) => (name.toLowerCase() === 'mira' ? 'taken' : 'ok')),
    accept: vi.fn(async () => gate({ termsOk: true, privacyOk: true })),
    setUsername: vi.fn(async (name: string) => gate({ termsOk: true, privacyOk: true, username: name, accepted: true })),
    deleteAccount: vi.fn(async () => Date.parse('2026-11-10T12:00:00Z')),
    ...over,
  } as never;
}

describe('Profile → Username (T62)', () => {
  it('shows when it can change again (once every 30 days)', () => {
    render(<UsernameCard gate={gate({ username: 'Mira', accepted: true, nextChangeAt: Date.now() + 5 * 86_400_000 })} api={fakeApi()} />);
    expect(screen.getByText('@Mira')).toBeInTheDocument();
    expect(screen.getByText(/You can change it again on .* \(once every 30 days\)\./)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change username' })).toBeNull();
  });

  it('changes it with the same live check; the current name can’t be “saved” again', async () => {
    const api = fakeApi();
    render(<UsernameCard gate={gate({ username: 'Mira', accepted: true })} api={api} />);
    fireEvent.click(screen.getByRole('button', { name: 'Change username' }));
    expect(screen.getByText('That’s your username now.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save username' })).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox', { name: 'Username' }), { target: { value: 'Rose' } });
    expect(await screen.findByText('Available.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save username' }));
    expect(await screen.findByText('Your username is now @Rose.')).toBeInTheDocument();
  });
});
