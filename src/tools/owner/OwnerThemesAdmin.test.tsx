import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearOwnerThemes, loadOwnerThemes } from '../../core/theme/ownerThemes';
import { ThemePage } from '../account/sections';
import { OwnerThemesAdmin } from './OwnerThemesAdmin';

const theme = { id: 'night', name: 'Night', mood: 'A dark room', tone: 'dark', tokens: { 'bg-app': '#120d33', 'bg-card': '#1a1440', 'ink-5': '#9a92c8' }, scene: 'scenes/night.svg', ornaments: [] };

/** A fake private bucket that remembers uploads. */
function fakeStore(initial: Record<string, string> = {}) {
  const files = new Map<string, Blob>(Object.entries(initial).map(([k, v]) => [k, new Blob([v])]));
  return {
    files,
    download: vi.fn(async (p: string) => files.get(p) ?? null),
    upload: vi.fn(async (p: string, f: Blob) => void files.set(p, f)),
  };
}

describe('owner-only themes in the app (T47)', () => {
  beforeEach(() => {
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => 'blob:x');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  });
  afterEach(() => {
    clearOwnerThemes();
    vi.restoreAllMocks();
  });

  it('Account → Theme: no trace of them for anyone whose themes never loaded', () => {
    render(<ThemePage />);
    expect(screen.queryByRole('region', { name: 'Only for you' })).toBeNull();
    expect(screen.getByRole('radiogroup', { name: 'Theme' })).toBeInTheDocument();
  });

  it('Account → Theme: once loaded for an owner, “Only for you” lists them and picking one saves owner:<id>', async () => {
    await act(() => loadOwnerThemes(fakeStore({ 'manifest.json': JSON.stringify({ themes: [theme] }), 'scenes/night.svg': '<svg/>' })));
    render(<ThemePage />);
    const own = screen.getByRole('radiogroup', { name: 'Your own themes' });
    fireEvent.click(own.querySelector('[role="radio"]') as HTMLElement);
    expect(screen.getByRole('radio', { name: /Night/ })).toHaveAttribute('aria-checked', 'true');
    expect(document.documentElement.dataset.theme).toBe('owner');
  });

  it('Owner console: a theme pack goes where its manifest says; files it doesn’t name are left out', async () => {
    const store = fakeStore();
    render(<OwnerThemesAdmin store={store} />);
    const pack = [new File([JSON.stringify({ themes: [theme] })], 'manifest.json'), new File(['<svg/>'], 'night.svg'), new File(['x'], 'stray.png')];
    fireEvent.change(screen.getByLabelText('Upload a theme pack'), { target: { files: pack } });
    await screen.findByText(/Saved 1 theme\. Not named in the manifest, left out: stray\.png\./);
    expect([...store.files.keys()].sort()).toEqual(['manifest.json', 'scenes/night.svg']);
    await waitFor(() => expect(screen.getByText('Drawn scene')).toBeInTheDocument());
  });

  it('Owner console: your own picture replaces the drawn scene, and can be taken off again', async () => {
    const store = fakeStore({ 'manifest.json': JSON.stringify({ themes: [{ ...theme, extra: 'kept' }] }), 'scenes/night.svg': '<svg/>' });
    await act(() => loadOwnerThemes(store));
    render(<OwnerThemesAdmin store={store} />);
    fireEvent.change(screen.getByLabelText('Use my picture'), { target: { files: [new File(['img'], 'me.webp', { type: 'image/webp' })] } });
    await screen.findByText(/Picture saved/);
    const saved = JSON.parse(await (store.files.get('manifest.json') as Blob).text());
    expect(saved.themes[0]).toMatchObject({ id: 'night', extra: 'kept', picture: expect.stringMatching(/^pictures\/night-\d+\.webp$/) });
    await screen.findByText('Your picture');
    fireEvent.click(screen.getByRole('button', { name: 'Use the drawn scene' }));
    await screen.findByText(/Back to the drawn scene/);
    const back = JSON.parse(await (store.files.get('manifest.json') as Blob).text());
    expect(back.themes[0].picture).toBeUndefined();
    // Not a picture: refused before anything is uploaded.
    store.upload.mockClear();
    fireEvent.change(screen.getByLabelText('Use my picture'), { target: { files: [new File(['x'], 'a.txt', { type: 'text/plain' })] } });
    await screen.findByText('Pick a PNG, JPEG, WebP or GIF picture.');
    expect(store.upload).not.toHaveBeenCalled();
  });

  it('Owner console: says so without a server', () => {
    render(<OwnerThemesAdmin store={null} />);
    expect(screen.getByText(/Owner themes need HLITH’s server/)).toBeInTheDocument();
  });
});
