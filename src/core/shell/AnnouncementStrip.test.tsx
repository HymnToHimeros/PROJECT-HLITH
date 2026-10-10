import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { activeAnnouncements, type Announcement } from '../data/announcements';
import { AnnouncementStrip } from './AnnouncementStrip';

const ann = (id: string, title: string, level: Announcement['level'] = 'info'): Announcement => ({
  id,
  title,
  body: 'More words',
  level,
  starts_at: '2026-10-01T00:00:00Z',
  ends_at: null,
  created_at: '2026-10-01T00:00:00Z',
});

beforeEach(() => localStorage.clear());

describe('announcement strip', () => {
  it('shows active announcements; hiding one is remembered on this device', async () => {
    const load = async () => [ann('a1', 'New lists are in'), ann('a2', 'Servers down Friday', 'warning')];
    const { unmount } = render(<AnnouncementStrip load={load} />);
    expect(await screen.findByRole('status', { name: 'Announcement: New lists are in' })).toHaveTextContent('More words');
    expect(screen.getByRole('alert', { name: 'Announcement: Servers down Friday' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Hide announcement: New lists are in' }));
    expect(screen.queryByText('New lists are in')).toBeNull();
    unmount();
    render(<AnnouncementStrip load={load} />);
    expect(await screen.findByText('Servers down Friday')).toBeInTheDocument();
    expect(screen.queryByText('New lists are in')).toBeNull();
  });

  it('shows nothing when there is nothing to say', async () => {
    const { container } = render(<AnnouncementStrip load={async () => []} />);
    await act(async () => {});
    expect(container).toBeEmptyDOMElement();
  });

  it('without a server, or signed out, there are none', async () => {
    expect(await activeAnnouncements(null)).toEqual([]);
    const signedOut = { auth: { getSession: async () => ({ data: { session: null } }) } } as unknown as Parameters<typeof activeAnnouncements>[0];
    expect(await activeAnnouncements(signedOut)).toEqual([]);
  });
});
