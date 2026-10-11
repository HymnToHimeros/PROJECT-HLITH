import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONTACT } from '../../../config/legal/content';
import { readUntil, setStanding, standingFrom, useStanding } from './standing';
import { bannedInAddress, CONTACT_EMAIL, Suspended } from './Suspended';

afterEach(() => setStanding(null));

describe('a suspended account (T60b)', () => {
  it('sees a calm screen with when it ends and the contact address (the same as on the public pages)', () => {
    const onSignOut = vi.fn();
    render(<Suspended until={Date.parse('2026-10-18T12:00:00Z')} onSignOut={onSignOut} />);
    expect(screen.getByRole('heading', { name: 'Account suspended' })).toBeInTheDocument();
    expect(screen.getByText(/This account is suspended until/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: CONTACT_EMAIL })).toHaveAttribute('href', `mailto:${CONTACT_EMAIL}`);
    expect(CONTACT_EMAIL).toBe(CONTACT);
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(onSignOut).toHaveBeenCalled();
  });

  it('can still download its own data (the privacy page promises export any time)', async () => {
    const onDownload = vi.fn(async () => undefined);
    render(<Suspended until={Infinity} onDownload={onDownload} onSignOut={() => {}} />);
    expect(screen.getByText(/you can still download it/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Download my data' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Your data is downloading.');
    expect(onDownload).toHaveBeenCalled();
  });

  it('a permanent ban reads “until further notice”; a refused sign-in says only that it is suspended', () => {
    const { unmount } = render(<Suspended until={Infinity} />);
    expect(screen.getByText('This account is suspended until further notice.')).toBeInTheDocument();
    unmount();
    render(<Suspended until={null} />);
    expect(screen.getByText('This account is suspended.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull();
  });

  it('spots a sign-in Supabase refused for a ban, in the query or the #', () => {
    expect(bannedInAddress('?error=access_denied&error_code=user_banned&error_description=User+is+banned', '')).toBe(true);
    expect(bannedInAddress('', '#error=access_denied&error_description=User%20is%20banned')).toBe(true);
    expect(bannedInAddress('?error_code=otp_expired', '')).toBe(false);
    expect(bannedInAddress('', '#invite=abc')).toBe(false);
  });
});

describe('the account’s standing', () => {
  it('reads the server’s times; "infinity" means no end', () => {
    expect(readUntil('infinity')).toBe(Infinity);
    expect(readUntil('2026-10-18T12:00:00Z')).toBe(Date.parse('2026-10-18T12:00:00Z'));
    expect(readUntil(null)).toBeNull();
    expect(standingFrom({ banned_until: null, silenced_until: 'infinity' })).toEqual({ bannedUntil: null, silencedUntil: Infinity });
    expect(standingFrom(null)).toEqual({ bannedUntil: null, silencedUntil: null });
  });

  it('a ban counts as silenced too, and times that ran out count as nothing', () => {
    let seen: ReturnType<typeof useStanding> | null = null;
    function Probe() {
      seen = useStanding();
      return null;
    }
    render(<Probe />);
    act(() => setStanding({ bannedUntil: Date.now() + 60_000, silencedUntil: null }));
    expect(seen).toMatchObject({ banned: true, silenced: true });
    act(() => setStanding({ bannedUntil: Date.now() - 60_000, silencedUntil: Date.now() - 60_000 }));
    expect(seen).toMatchObject({ banned: false, silenced: false });
  });
});
