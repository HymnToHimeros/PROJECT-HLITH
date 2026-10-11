import { afterEach, describe, expect, it, vi } from 'vitest';
import { reloadPrefs } from '../data/prefs';
import { clearOwnerThemes, loadOwnerThemes, ownerThemeFor, ownerThemesState, readOwnerManifest, readOwnerTheme, type OwnerThemeSource } from './ownerThemes';
import { applyTheme } from './theme';

const good = { id: 'night', name: 'Night', mood: 'A dark room', tone: 'dark', tokens: { 'bg-app': '#120d33', 'bg-card': '#1a1440', 'ink-5': '#9a92c8', 'owner-art-opacity': '0.5' }, scene: 'scenes/night.svg', ornaments: ['hearts', 'nope'] };

/** A fake private store: path → text. */
const store = (files: Record<string, string>): OwnerThemeSource => ({ download: async (p) => (p in files ? new Blob([files[p] as string]) : null) });

describe('owner-only themes (T47)', () => {
  afterEach(() => {
    clearOwnerThemes();
    localStorage.clear();
    reloadPrefs();
  });

  it('keeps only colours and a few numbers: no other CSS gets in', () => {
    const out = readOwnerTheme({ ...good, tokens: { ...good.tokens, 'bg-raised': 'url(https://x.example/a.png)', 'ink-1': 'red;}', 'art-opacity': '2' } });
    expect('problems' in out && out.problems).toEqual([
      'night: token "bg-raised" must be a colour like #1a2b3c.',
      'night: token "ink-1" must be a colour like #1a2b3c.',
      'night: token "art-opacity" must be a number from 0 to 1.',
    ]);
    const ok = readOwnerTheme(good);
    expect('theme' in ok && ok.theme.ornaments).toEqual(['hearts']); // unknown ornaments dropped
  });

  it('holds every theme to the ink.5 rule (4.5:1 on bg.app and bg.card)', () => {
    const out = readOwnerTheme({ ...good, tokens: { 'bg-app': '#120d33', 'bg-card': '#5a5a7a', 'ink-5': '#9a92c8' } });
    expect('problems' in out && out.problems[0]).toMatch(/ink-5 reaches only [\d.]+:1 on bg-card; needs 4.5:1/);
  });

  it('file paths stay inside the bucket', () => {
    expect('problems' in readOwnerTheme({ ...good, scene: '../secrets.json' })).toBe(true);
    expect('problems' in readOwnerTheme({ ...good, picture: 'https://x.example/a.png' })).toBe(true);
  });

  it('a manifest keeps its good themes and says why the others were left out', () => {
    const out = readOwnerManifest({ themes: [good, { ...good }, { id: 'Bad Id', name: '' }] });
    expect(out.themes.map((t) => t.id)).toEqual(['night']);
    expect(out.problems).toEqual(expect.arrayContaining(['night: listed twice; the first one is used.', expect.stringMatching(/^Bad Id: id must be/)]));
  });

  it('loads the manifest and files, applies the colours on top of Glacier, and forgets them on sign-out', async () => {
    const create = vi.spyOn(URL, 'createObjectURL').mockImplementation(() => 'blob:scene');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    await loadOwnerThemes(store({ 'manifest.json': JSON.stringify({ themes: [good] }), 'scenes/night.svg': '<svg/>' }));
    const s = ownerThemesState();
    expect(s.status === 'ready' && s.themes[0]).toMatchObject({ id: 'night', sceneUrl: 'blob:scene' });
    expect(ownerThemeFor('owner:night')?.name).toBe('Night');
    expect(ownerThemeFor('dark')).toBeUndefined();

    applyTheme('owner:night');
    const root = document.documentElement;
    expect(root.dataset.theme).toBe('owner');
    expect(root.dataset.ornaments).toBe('hearts');
    expect(root.style.getPropertyValue('--bg-app')).toBe('#120d33');
    // Back to a built-in theme: the owner colours are taken off again.
    applyTheme('crimson');
    expect(root.dataset.theme).toBe('crimson');
    expect(root.style.getPropertyValue('--bg-app')).toBe('');
    expect(root.dataset.ornaments).toBeUndefined();

    clearOwnerThemes();
    expect(ownerThemesState()).toEqual({ status: 'none' });
    expect(revoke).toHaveBeenCalledWith('blob:scene');
    // Saved choice kept, but without the loaded theme it shows Glacier.
    applyTheme('owner:night');
    expect(root.dataset.theme).toBe('dark');
    create.mockRestore();
    revoke.mockRestore();
  });

  it('no manifest yet = no themes; a missing file is named', async () => {
    await loadOwnerThemes(store({}));
    expect(ownerThemesState()).toEqual({ status: 'ready', themes: [], problems: [] });
    await loadOwnerThemes(store({ 'manifest.json': JSON.stringify({ themes: [good] }) }));
    const s = ownerThemesState();
    expect(s.status === 'ready' && s.problems).toEqual(['night: scene scenes/night.svg isn’t in the bucket.']);
  });

  it('a store that can’t be reached is an error, not an empty list', async () => {
    await loadOwnerThemes({ download: async () => Promise.reject(new Error('offline')) });
    expect(ownerThemesState()).toEqual({ status: 'error', message: 'offline' });
  });
});
