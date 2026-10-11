import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearOwnerThemes, loadOwnerThemes } from '../../core/theme/ownerThemes';
import { ThemePage } from '../account/sections';
import { OwnerThemesAdmin } from './OwnerThemesAdmin';

const theme = { id: 'night', name: 'Night', mood: 'A dark room', tone: 'dark', tokens: { 'bg-app': '#120d33', 'bg-card': '#1a1440', 'ink-5': '#9a92c8' }, ornaments: [] };

/** A fake private bucket that remembers uploads. */
function fakeStore(initial: Record<string, string> = {}) {
  const files = new Map<string, Blob>(Object.entries(initial).map(([k, v]) => [k, new Blob([v])]));
  return {
    files,
    download: vi.fn(async (p: string) => files.get(p) ?? null),
    upload: vi.fn(async (p: string, f: Blob) => void files.set(p, f)),
  };
}
const manifest = async (store: ReturnType<typeof fakeStore>) => JSON.parse(await (store.files.get('manifest.json') as Blob).text());

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
    await act(() => loadOwnerThemes(fakeStore({ 'manifest.json': JSON.stringify({ themes: [theme] }) })));
    render(<ThemePage />);
    const own = screen.getByRole('radiogroup', { name: 'Your own themes' });
    fireEvent.click(own.querySelector('[role="radio"]') as HTMLElement);
    expect(screen.getByRole('radio', { name: /Night/ })).toHaveAttribute('aria-checked', 'true');
    expect(document.documentElement.dataset.theme).toBe('owner');
  });

  it('Owner console: add a theme from a colour set with ornaments; no picture until you give one', async () => {
    const store = fakeStore();
    await act(() => loadOwnerThemes(store));
    render(<OwnerThemesAdmin store={store} />);
    const form = screen.getByRole('form', { name: 'Add a theme' });
    fireEvent.change(within(form).getByLabelText('Name'), { target: { value: 'After Hours' } });
    fireEvent.click(within(form).getByLabelText('Gold frame'));
    fireEvent.click(within(form).getByRole('button', { name: 'Add theme' }));
    await screen.findByText(/Added After Hours/);
    const saved = (await manifest(store)).themes[0];
    expect(saved).toMatchObject({ id: 'after-hours', name: 'After Hours', ornaments: ['hearts', 'bubbles', 'gold-frame'] });
    expect(saved.picture).toBeUndefined();
    expect(await screen.findByText('No picture yet')).toBeInTheDocument();
  });

  it('Owner console: your own picture, ornaments, taking the picture off, removing the theme', async () => {
    const store = fakeStore({ 'manifest.json': JSON.stringify({ themes: [{ ...theme, extra: 'kept' }] }) });
    await act(() => loadOwnerThemes(store));
    render(<OwnerThemesAdmin store={store} />);
    fireEvent.change(screen.getByLabelText('Use my picture'), { target: { files: [new File(['img'], 'me.webp', { type: 'image/webp' })] } });
    await screen.findByText('Picture saved.');
    expect((await manifest(store)).themes[0]).toMatchObject({ id: 'night', extra: 'kept', picture: expect.stringMatching(/^pictures\/night-\d+\.webp$/) });
    await screen.findByText('Your picture');

    fireEvent.click(within(screen.getByRole('group', { name: 'Night ornaments' })).getByLabelText('Hearts'));
    await waitFor(async () => expect((await manifest(store)).themes[0].ornaments).toEqual(['hearts']));

    fireEvent.click(await screen.findByRole('button', { name: 'Take the picture off' }));
    await screen.findByText(/Picture taken off/);
    expect((await manifest(store)).themes[0].picture).toBeUndefined();

    // Not a picture: refused before anything is uploaded.
    store.upload.mockClear();
    fireEvent.change(screen.getByLabelText('Use my picture'), { target: { files: [new File(['x'], 'a.txt', { type: 'text/plain' })] } });
    await screen.findByText('Pick a PNG, JPEG, WebP or GIF picture.');
    expect(store.upload).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Remove Night' }));
    await screen.findByText(/Night is off the list/);
    expect((await manifest(store)).themes).toEqual([]);
  });

  it('Owner console: says so without a server', () => {
    render(<OwnerThemesAdmin store={null} />);
    expect(screen.getByText(/Owner themes need HLITH’s server/)).toBeInTheDocument();
  });
});
