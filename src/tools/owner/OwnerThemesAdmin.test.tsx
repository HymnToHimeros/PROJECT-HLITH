import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearOwnerThemes, loadOwnerThemes } from '../../core/theme/ownerThemes';
import { ThemePage } from '../account/sections';
import { getPrefs, updatePrefs } from '../../core/data/prefs';
import { setTheme } from '../../core/theme/theme';
import { mergeDrafts, OwnerThemesAdmin, setThemeIds, sha256, withoutThemes, withThemesBack } from './OwnerThemesAdmin';

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
    // A confirm step first: Keep it changes nothing.
    fireEvent.click(screen.getByRole('button', { name: 'Keep it' }));
    expect((await manifest(store)).themes).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Night' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, remove Night' }));
    await screen.findByText(/Night is off the list/);
    expect((await manifest(store)).themes).toEqual([]);
    // Undo puts it back as it was.
    fireEvent.click(await screen.findByRole('button', { name: 'Undo: put Night back' }));
    await screen.findByText(/Night is back on the list/);
    expect((await manifest(store)).themes[0]).toMatchObject({ id: 'night', extra: 'kept' });
  });

  it('“Remove the set themes” takes out only the set themes (marked, or the early ones by id), never yours; a worn one falls back (T74)', async () => {
    const t = (id: string, extra: Record<string, unknown> = {}) => ({ ...theme, id, name: `Theme ${id}`, ...extra });
    const store = fakeStore({ 'manifest.json': JSON.stringify({ themes: [t('mine'), t('early-a'), t('fresh', { origin: 'set' }), t('early-b'), t('night-2')] }) });
    await act(() => loadOwnerThemes(store));
    setTheme('light');
    setTheme('owner:early-a');
    expect(getPrefs().themeBefore).toBe('light');
    render(<OwnerThemesAdmin store={store} early={new Set([await sha256('early-a'), await sha256('early-b')])} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove the set themes' }));
    await screen.findByText(/This takes out 3 set themes/);
    fireEvent.click(screen.getByRole('button', { name: 'Yes, remove the set themes' }));
    await screen.findByText(/The 3 set themes are off the list/);
    expect((await manifest(store)).themes.map((x: { id: string }) => x.id)).toEqual(['mine', 'night-2']);
    // The worn set theme is gone: back to the theme worn before it.
    expect(getPrefs().theme).toBe('light');
    // Undo puts all three back in their places.
    fireEvent.click(screen.getByRole('button', { name: 'Undo: put The 3 set themes back' }));
    await screen.findByText(/The 3 set themes are back on the list/);
    expect((await manifest(store)).themes.map((x: { id: string }) => x.id)).toEqual(['mine', 'early-a', 'fresh', 'early-b', 'night-2']);
  });

  it('removing the theme you wear with nothing before it goes back to Glacier', async () => {
    const store = fakeStore({ 'manifest.json': JSON.stringify({ themes: [theme] }) });
    await act(() => loadOwnerThemes(store));
    updatePrefs((p) => {
      const next = { ...p, theme: 'owner:night' as const };
      delete next.themeBefore;
      return next;
    });
    render(<OwnerThemesAdmin store={store} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Night' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, remove Night' }));
    await screen.findByText(/Night is off the list/);
    expect(getPrefs().theme).toBe('dark');
  });

  it('set-theme helpers: only set ids, and Undo skips an id that came back', async () => {
    const early = new Set([await sha256('early-a')]);
    expect(await setThemeIds([{ id: 'mine' }, { id: 'early-a' }, { id: 'x', origin: 'set' }], early)).toEqual(['early-a', 'x']);
    // The built-in list holds 10 fingerprints and matches none of a made-up theme's ids.
    expect(await setThemeIds([{ id: 'mine' }, { id: 'night' }])).toEqual([]);
    const m = { themes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] };
    const out = withoutThemes(m, ['b']);
    expect(out.manifest.themes.map((x) => x.id)).toEqual(['a', 'c']);
    expect(withThemesBack({ themes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] }, out.removed).themes).toHaveLength(3);
    expect(withThemesBack(out.manifest, out.removed).themes.map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });

  it('Owner console: says so without a server', () => {
    render(<OwnerThemesAdmin store={null} />);
    expect(screen.getByText(/Owner themes need HLITH’s server/)).toBeInTheDocument();
  });

  it('“Add the set themes” adds new drafts only; a theme already there is never changed or removed (T74)', () => {
    const mine = { id: 'mine', name: 'Mine', tone: 'dark', tokens: { 'bg-app': '#0a0b12', 'bg-card': '#10121c', 'ink-5': '#9aa3b8' }, ornaments: [] };
    const draft = (id: string, name: string) => ({ id, name, tone: 'dark', mood: '', tokens: { 'bg-app': '#0a0b12', 'bg-card': '#10121c', 'ink-5': '#9aa3b8' }, ornaments: ['orbit-light', 'starfield'] });
    const changed = { ...draft('two', 'Two'), name: 'Two (renamed by the owner)' };
    const out = mergeDrafts({ themes: [mine, changed], other: 1 }, [draft('one', 'One'), draft('two', 'Two'), { id: 'bad', name: '' }]);
    expect(out.added).toEqual(['One']);
    expect(out.kept).toBe(1);
    expect(out.problems.length).toBeGreaterThan(0);
    expect(out.manifest.themes.map((t) => t.id)).toEqual(['mine', 'two', 'one']);
    expect(out.manifest.themes[1]).toBe(changed);
    expect(out.manifest.themes[2]).toMatchObject({ id: 'one', origin: 'set' });
    expect(out.manifest.other).toBe(1);
  });
});
