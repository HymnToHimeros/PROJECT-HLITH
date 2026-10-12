import { useState, type FormEvent } from 'react';
import { backend } from '../../core/data/backend';
import { supabaseOwnerThemes } from '../../core/data/ownerThemesSource';
import { getPrefs } from '../../core/data/prefs';
import { setTheme } from '../../core/theme/theme';
import { isOwnerThemeId, loadOwnerThemes, ORNAMENTS, OWNER_PREFIX, OWNER_PRESETS, readOwnerTheme, useOwnerThemes, type Ornament } from '../../core/theme/ownerThemes';
import { Button, HowTo, NoData } from '../../core/ui';
import o from './owner.module.css';

type Store = ReturnType<typeof supabaseOwnerThemes>;
type Raw = Record<string, unknown>;

const PICTURE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const extOf = (f: File) => ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' })[f.type] ?? 'bin';
const ORNAMENT_LABEL: Record<Ornament, string> = {
  hearts: 'Hearts',
  bubbles: 'Speech-bubble notes',
  'gold-frame': 'Gold frame',
  lace: 'Lace',
  'orbit-light': 'Two lights crossing',
  'corona-ring': 'Ringed eclipse',
  'phase-band': 'Moon phases along the top',
  'ember-rise': 'Rising embers',
  'frost-trail': 'Frost and a trail of prints',
  'storm-streaks': 'Rain and lightning',
  'aurora-veil': 'Aurora curtains',
  'knot-band': 'Knotwork bands',
  'shield-row': 'Shield row with torchlight',
  'sound-rings': 'Spreading rings',
  starfield: 'Starfield texture',
  grain: 'Grain texture',
  'hex-mesh': 'Hex mesh texture',
  'rune-rows': 'Rune rows texture',
  'accent-diamond': 'Diamond marker',
  'accent-crescent': 'Crescent marker',
  'accent-ring': 'Ring marker',
  'accent-rune': 'Rune marker',
};

/** The manifest as stored (kept as-is, so fields this page doesn't know survive an edit). */
async function rawManifest(store: Store): Promise<{ themes: Raw[] } & Raw> {
  const blob = await store.download('manifest.json');
  if (!blob) return { themes: [] };
  const raw = JSON.parse(await blob.text()) as { themes?: unknown };
  return { ...(raw as Raw), themes: Array.isArray(raw.themes) ? (raw.themes as Raw[]) : [] };
}
const saveManifest = (store: Store, m: { themes: Raw[] } & Raw) =>
  store.upload('manifest.json', new Blob([JSON.stringify(m, null, 2)], { type: 'application/json' }), 'application/json');

/** "After Hours" → "after-hours" (kept unique against the ids already used). */
function idFor(name: string, taken: string[]): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'theme';
  let id = base;
  for (let n = 2; taken.includes(id); n++) id = `${base}-${n}`;
  return id;
}

/**
 * Owner console → Owner themes (T47): themes only the owner can see and pick, kept in the private
 * store (manifest.json + pictures) that only owner accounts can read. Add a theme (name, colour
 * set, ornaments), give it a picture of your own as its background, change its ornaments or take it
 * off the list. Nothing here is in the app's public code; a later "generate a picture" button
 * would save into the same picture slot.
 */
/** Theme drafts made for the owner (0020, owners only), waiting to be added to the private store. */
async function serverDrafts(): Promise<Raw[]> {
  if (!backend) return [];
  const { data, error } = await backend.rpc('owner_theme_drafts');
  if (error) throw new Error(error.message);
  return Array.isArray(data) ? (data as Raw[]) : [];
}

/**
 * Adds the drafts to the manifest: new ids only. A theme already in the store (the owner's own,
 * or a draft added before and maybe changed since) is never removed or overwritten.
 */
export function mergeDrafts(m: { themes: Raw[] } & Raw, drafts: Raw[]): { manifest: { themes: Raw[] } & Raw; added: string[]; kept: number; problems: string[] } {
  const ids = new Set(m.themes.map((t) => String(t.id)));
  const added: string[] = [];
  const problems: string[] = [];
  let kept = 0;
  const themes = [...m.themes];
  for (const d of drafts) {
    if (ids.has(String(d.id))) {
      kept++;
      continue;
    }
    const checked = readOwnerTheme(d);
    if ('problems' in checked) {
      problems.push(...checked.problems);
      continue;
    }
    themes.push({ ...d, origin: 'set' });
    ids.add(checked.theme.id);
    added.push(checked.theme.name);
  }
  return { manifest: { ...m, themes }, added, kept, problems };
}

/**
 * The themes the set-theme button added before it marked them (`origin: 'set'`), known only by
 * the SHA-256 of their ids, so this public code names none of them.
 */
const EARLY_SET_IDS = new Set([
  'df3d299865a63ca42b4099787e5902622d445197b5e5f1747324eb2fcdc21e96',
  '437712f4b27376860d02001687360d68d2390b3028a69cee638fc920dcc38dac',
  '0ff4b87a0708db0d46788f26e76fcf6343ecc65306239f1936fe721c274130a8',
  '2741ce3f7f39ecd8ac58a4394289644c3d7d3474db2c8ec36f02c08ed838983b',
  'fc1f420480f3f16c18254db6b6924b88621815e1a566a09cde2480be3361e418',
  '1584b339e3ba6e5f156a1317fe1c81746d0cf081292b27b856af7b59033cea62',
  '5debc7fa6a2c4b8ef17fd0ab68f9c38650aea2db4d30f9f9e852fa14f38ded42',
  '208f5f4b025d7a144221fa31c687e92ffeea7099fab076b960f0d6c7cff19cdf',
  'a8adf040d5380e118d2d20dfab9bd77c90e20683bab66777a9ce69bc465ca40e',
  '1feab6aac41e5809e11d3d7df0a326f3d0ac024ad2f3a2895c5d2199403361e9',
]);
export async function sha256(text: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Ids of the themes the set-theme button added (never one the owner made). */
export async function setThemeIds(themes: Raw[], early: Set<string> = EARLY_SET_IDS): Promise<string[]> {
  const out: string[] = [];
  for (const t of themes) if (t.origin === 'set' || early.has(await sha256(String(t.id)))) out.push(String(t.id));
  return out;
}

/** Takes the given ids out of the manifest; returns the new manifest and what was taken (with its place), for Undo. */
export function withoutThemes(m: { themes: Raw[] } & Raw, ids: string[]): { manifest: { themes: Raw[] } & Raw; removed: { at: number; theme: Raw }[] } {
  const removed: { at: number; theme: Raw }[] = [];
  const themes = m.themes.filter((t, at) => {
    if (!ids.includes(String(t.id))) return true;
    removed.push({ at, theme: t });
    return false;
  });
  return { manifest: { ...m, themes }, removed };
}

/** Puts removed themes back where they were (skipping any id that is back already). */
export function withThemesBack(m: { themes: Raw[] } & Raw, removed: { at: number; theme: Raw }[]): { themes: Raw[] } & Raw {
  const themes = [...m.themes];
  for (const r of removed) if (!themes.some((t) => t.id === r.theme.id)) themes.splice(Math.min(r.at, themes.length), 0, r.theme);
  return { ...m, themes };
}

/** What Remove took this session, so Undo can put it back (survives leaving the page, not a reload). */
let lastRemoved: { label: string; removed: { at: number; theme: Raw }[] } | null = null;

/** If the theme being worn is going away, go back to the built-in theme worn before it (or Glacier). */
function stopWearing(ids: string[]): void {
  const worn = getPrefs().theme;
  if (!isOwnerThemeId(worn) || !ids.includes(worn.slice(OWNER_PREFIX.length))) return;
  setTheme(getPrefs().themeBefore ?? 'dark');
}

export function OwnerThemesAdmin({
  store = backend ? supabaseOwnerThemes(backend) : null,
  drafts = serverDrafts,
  early = EARLY_SET_IDS,
}: {
  store?: Store | null;
  drafts?: () => Promise<Raw[]>;
  /** Test hook: the fingerprints of the early set-theme ids. */
  early?: Set<string>;
}) {
  const state = useOwnerThemes();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [preset, setPreset] = useState(OWNER_PRESETS[0]?.id ?? '');
  const [ornaments, setOrnaments] = useState<Ornament[]>(['hearts', 'bubbles']);
  /** The theme id (or 'sets') waiting for "Yes, remove". */
  const [confirming, setConfirming] = useState<string | null>(null);
  const [undo, setUndo] = useState(lastRemoved);
  if (!store)
    return (
      <p className={o.note}>
        <NoData dash={false} /> Owner themes need HLITH’s server and an owner sign-in.
      </p>
    );

  const run = async (what: () => Promise<string>) => {
    setBusy(true);
    setNote(null);
    try {
      setNote(await what());
      await loadOwnerThemes(store);
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'That didn’t work.');
    } finally {
      setBusy(false);
    }
  };

  /** Changes one theme in the stored manifest (or removes it with null). */
  const edit = (id: string, change: (t: Raw) => Raw | null) =>
    rawManifest(store).then((m) =>
      saveManifest(store, {
        ...m,
        themes: m.themes.flatMap((t) => {
          if (t.id !== id) return [t];
          const next = change(t);
          return next ? [next] : [];
        }),
      }),
    );

  const add = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const p = OWNER_PRESETS.find((x) => x.id === preset);
      if (!p) throw new Error('Pick a colour set.');
      const m = await rawManifest(store);
      const theme = { id: idFor(name, m.themes.map((t) => String(t.id))), name: name.trim(), mood: '', tone: p.tone, tokens: p.tokens, ornaments };
      const checked = readOwnerTheme(theme);
      if ('problems' in checked) throw new Error(checked.problems.join(' '));
      await saveManifest(store, { ...m, themes: [...m.themes, theme] });
      setName('');
      return `Added ${theme.name}. Give it a picture with “Use my picture”, then pick it in Account → Theme.`;
    });
  };

  const addDrafts = () =>
    run(async () => {
      const list = await drafts();
      if (list.length === 0) return 'There are no new themes waiting.';
      const m = await rawManifest(store);
      const out = mergeDrafts(m, list);
      if (out.added.length) await saveManifest(store, out.manifest);
      const parts = [out.added.length ? `Added ${out.added.length}: ${out.added.join(', ')}. Pick one in Account → Theme → Only for you.` : 'Nothing new to add.'];
      if (out.kept) parts.push(`${out.kept} ${out.kept === 1 ? 'was' : 'were'} already there and stayed as they are.`);
      if (out.problems.length) parts.push(`Left out: ${out.problems.join(' ')}`);
      return parts.join(' ');
    });

  const setPicture = (id: string, file: File | null) =>
    run(async () => {
      let path: string | undefined;
      if (file) {
        if (!PICTURE_TYPES.includes(file.type)) throw new Error('Pick a PNG, JPEG, WebP or GIF picture.');
        if (file.size > 10 * 1024 * 1024) throw new Error('That picture is over 10 MB.');
        path = `pictures/${id}-${Date.now()}.${extOf(file)}`;
        await store.upload(path, file, file.type);
      }
      await edit(id, (t) => {
        const rest = { ...t };
        delete rest.picture;
        return path ? { ...rest, picture: path } : rest;
      });
      return file ? 'Picture saved.' : 'Picture taken off: colours and ornaments only.';
    });

  const toggleOrnament = (id: string, current: Ornament[], which: Ornament) =>
    run(async () => {
      await edit(id, (t) => ({ ...t, ornaments: current.includes(which) ? current.filter((x) => x !== which) : [...current, which] }));
      return 'Saved.';
    });

  const removeIds = (ids: string[], label: string) =>
    run(async () => {
      setConfirming(null);
      const m = await rawManifest(store);
      const out = withoutThemes(m, ids);
      if (out.removed.length === 0) return 'Nothing to remove.';
      await saveManifest(store, out.manifest);
      stopWearing(ids);
      lastRemoved = { label, removed: out.removed };
      setUndo(lastRemoved);
      return `${label} ${out.removed.length === 1 ? 'is' : 'are'} off the list. Pictures stay in the private store.`;
    });

  const removeSets = () =>
    run(async () => {
      const ids = await setThemeIds((await rawManifest(store)).themes, early);
      if (ids.length === 0) {
        setConfirming(null);
        return 'None of the set themes are on the list.';
      }
      setConfirming('sets');
      return `This takes out ${ids.length} set ${ids.length === 1 ? 'theme' : 'themes'}. Your own themes stay.`;
    });

  const undoRemove = () =>
    run(async () => {
      const last = lastRemoved;
      if (!last) return 'Nothing to undo.';
      await saveManifest(store, withThemesBack(await rawManifest(store), last.removed));
      lastRemoved = null;
      setUndo(null);
      return `${last.label} ${last.removed.length === 1 ? 'is' : 'are'} back on the list.`;
    });

  const confirmSets = () =>
    void rawManifest(store)
      .then((m) => setThemeIds(m.themes, early))
      .then((ids) => removeIds(ids, ids.length === 1 ? 'The set theme' : `The ${ids.length} set themes`));

  return (
    <div className={o.stack}>
      <section className={o.card} aria-label="Owner themes">
        <h3 className={o.cardTitle}>Owner themes</h3>
        <p className={o.note}>
          Themes only you can see and pick (Account → Theme → Only for you). They’re kept in a private store that only owner accounts can read; other accounts never
          download them.
        </p>
        <div className={o.jobActions}>
          <Button variant="primary" disabled={busy} onClick={() => void addDrafts()}>
            Add the set themes
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => void removeSets()}>
            Remove the set themes
          </Button>
        </div>
        <p className={o.note}>
          Add puts the themes made for your sets on this list; Remove takes exactly those off again. Your own themes are never changed or removed by either.
        </p>
        {confirming === 'sets' && (
          <div className={o.confirm} role="group" aria-label="Confirm removing the set themes">
            <Button variant="primary" disabled={busy} onClick={confirmSets}>
              Yes, remove the set themes
            </Button>
            <Button variant="quiet" disabled={busy} onClick={() => setConfirming(null)}>
              Keep them
            </Button>
          </div>
        )}
        {state.status === 'loading' && <p className={o.note}>Loading…</p>}
        {state.status === 'error' && <p className={o.note}>Couldn’t load them: {state.message}</p>}
        {state.status === 'ready' && state.problems.length > 0 && (
          <ul className={o.note} aria-label="Problems in the manifest">
            {state.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        {state.status === 'ready' && state.themes.length === 0 && (
          <p className={o.note}>
            <NoData dash={false} /> No owner themes yet. Add one below.
          </p>
        )}
        {state.status === 'ready' &&
          state.themes.map((t) => (
            <div key={t.id} className={o.ownerThemeRow}>
              <span className={o.ownerThemeThumb} style={t.pictureUrl ? { backgroundImage: `url(${t.pictureUrl})` } : { background: t.tokens['bg-app'] }} aria-hidden="true" />
              <span className={o.ownerThemeText}>
                <strong>{t.name}</strong>
                <span className={o.note}>{t.picture ? 'Your picture' : 'No picture yet'}</span>
                <span className={o.ownerOrnaments} role="group" aria-label={`${t.name} ornaments`}>
                  {ORNAMENTS.map((x) => (
                    <label key={x} className={o.note}>
                      <input type="checkbox" checked={t.ornaments.includes(x)} disabled={busy} onChange={() => void toggleOrnament(t.id, t.ornaments, x)} /> {ORNAMENT_LABEL[x]}
                    </label>
                  ))}
                </span>
              </span>
              <label className={o.fileButton}>
                {t.picture ? 'Change picture' : 'Use my picture'}
                <input className={o.fileInput} type="file" accept={PICTURE_TYPES.join(',')} disabled={busy} onChange={(e) => e.target.files?.[0] && void setPicture(t.id, e.target.files[0])} />
              </label>
              {t.picture && (
                <Button variant="quiet" disabled={busy} onClick={() => void setPicture(t.id, null)}>
                  Take the picture off
                </Button>
              )}
              {confirming === t.id ? (
                <span className={o.confirm} role="group" aria-label={`Confirm removing ${t.name}`}>
                  <Button variant="primary" disabled={busy} onClick={() => void removeIds([t.id], t.name)}>
                    Yes, remove {t.name}
                  </Button>
                  <Button variant="quiet" disabled={busy} onClick={() => setConfirming(null)}>
                    Keep it
                  </Button>
                </span>
              ) : (
                <Button variant="secondary" disabled={busy} onClick={() => setConfirming(t.id)}>
                  Remove {t.name}
                </Button>
              )}
            </div>
          ))}
        {note && (
          <p className={o.note} role="status">
            {note}
          </p>
        )}
        {undo && (
          <div className={o.jobActions}>
            <Button variant="secondary" disabled={busy} onClick={() => void undoRemove()}>
              Undo: put {undo.label} back
            </Button>
          </div>
        )}
      </section>

      <form className={o.card} aria-label="Add a theme" onSubmit={add}>
        <h3 className={o.cardTitle}>Add a theme</h3>
        <label className={o.field}>
          <span>Name</span>
          <input className={o.input} value={name} maxLength={40} required onChange={(e) => setName(e.target.value)} />
        </label>
        <label className={o.field}>
          <span>Colours</span>
          <select className={o.input} value={preset} onChange={(e) => setPreset(e.target.value)}>
            {OWNER_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <fieldset className={o.ownerOrnaments}>
          <legend className={o.note}>Ornaments</legend>
          {ORNAMENTS.map((x) => (
            <label key={x} className={o.note}>
              <input type="checkbox" checked={ornaments.includes(x)} onChange={() => setOrnaments((cur) => (cur.includes(x) ? cur.filter((y) => y !== x) : [...cur, x]))} />{' '}
              {ORNAMENT_LABEL[x]}
            </label>
          ))}
        </fieldset>
        <Button type="submit" variant="primary" disabled={busy || !name.trim()}>
          Add theme
        </Button>
      </form>

      <HowTo
        steps={[
          'Add a theme: give it a name, pick its colours and ornaments, press “Add theme”.',
          '“Use my picture” puts a picture of your own behind that theme. Only you can see it.',
          'Choose the theme in Account → Theme → Only for you.',
        ]}
      />
    </div>
  );
}
