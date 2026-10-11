import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LEGAL_VERSIONS } from '../../../config/legal/versions';
import { FirstRun } from './FirstRun';
import { gateFrom, type Gate, type GateApi } from './gate';

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

describe('first run (T62)', () => {
  it('step 1: short summaries, links to the full texts, and Continue only once the box is ticked', async () => {
    const api = fakeApi();
    const onDone = vi.fn();
    render(<FirstRun gate={gate()} api={api} onDone={onDone} onSignOut={() => {}} />);
    expect(screen.getByText('STEP 1 OF 2')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Read the full Terms of service' })).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('link', { name: 'Read the full Privacy policy' })).toHaveAttribute('href', '/privacy');
    const go = screen.getByRole('button', { name: 'Continue' });
    expect(go).toBeDisabled();
    fireEvent.click(screen.getByLabelText('I have read and understood the Terms of service and Privacy policy, and I agree to them.'));
    expect(go).toBeEnabled();
    fireEvent.click(go);
    await vi.waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(api.accept).toHaveBeenCalledWith(LEGAL_VERSIONS.terms, LEGAL_VERSIONS.privacy);
  });

  it('step 2: the display name is suggested, a live check says taken or available, and only a free name continues', async () => {
    const api = fakeApi();
    const onDone = vi.fn();
    render(<FirstRun gate={gate({ termsOk: true, privacyOk: true, suggested: 'Mira' })} api={api} onDone={onDone} onSignOut={() => {}} />);
    expect(screen.getByText('STEP 2 OF 2')).toBeInTheDocument();
    const input = screen.getByLabelText('Username');
    expect(input).toHaveValue('Mira');
    expect(await screen.findByText('Taken. Try another.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    fireEvent.change(input, { target: { value: 'admin_mira' } });
    expect(screen.getByText(/could pass for HLIÐSKJÁLF or its staff/)).toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'Mira.Rose' } });
    expect(await screen.findByText('Available.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await vi.waitFor(() => expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ username: 'Mira.Rose', accepted: true })));
  });

  it('a new version only asks step 1 again', () => {
    render(<FirstRun gate={gate({ termsOk: false, privacyOk: true, username: 'Mira' })} api={fakeApi()} onDone={() => {}} onSignOut={() => {}} />);
    expect(screen.getByText('UPDATED TERMS')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'The Terms or Privacy policy changed' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Username')).toBeNull();
  });

  it('a page older than the server’s versions can’t accept them', () => {
    render(<FirstRun gate={gate({ termsVersion: LEGAL_VERSIONS.terms + 1 })} api={fakeApi()} onDone={() => {}} onSignOut={() => {}} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    expect(screen.getByText(/Reload it to read the current versions/)).toBeInTheDocument();
  });

  it('saying no stays possible: sign out, or delete the account after typing DELETE', async () => {
    const api = fakeApi();
    const onSignOut = vi.fn();
    render(<FirstRun gate={gate()} api={api} onDone={() => {}} onSignOut={onSignOut} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(onSignOut).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Delete my account' }));
    const confirm = screen.getAllByRole('button', { name: 'Delete my account' }).at(-1) as HTMLElement;
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Type DELETE to confirm/), { target: { value: 'DELETE' } });
    fireEvent.click(confirm);
    expect(await screen.findByRole('status')).toHaveTextContent(/deleted for good on .*Signing in again before then lets you keep it/);
    expect(api.deleteAccount).toHaveBeenCalled();
  });

  it('reads the server’s answer', () => {
    expect(gateFrom({ terms_version: 1, privacy_version: 1, terms_ok: true, privacy_ok: false, username: 'Mira', next_change_at: '2026-11-10T00:00:00Z', suggested: null, accepted: false })).toEqual({
      termsVersion: 1,
      privacyVersion: 1,
      termsOk: true,
      privacyOk: false,
      username: 'Mira',
      nextChangeAt: Date.parse('2026-11-10T00:00:00Z'),
      suggested: null,
      accepted: false,
    });
  });
});
