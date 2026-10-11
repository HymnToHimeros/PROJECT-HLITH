import { useState, type FormEvent } from 'react';
import { backend } from '../../core/data/backend';
import { supabaseOwnerThemes } from '../../core/data/ownerThemesSource';
import { loadOwnerThemes, ORNAMENTS, OWNER_PRESETS, readOwnerTheme, useOwnerThemes, type Ornament } from '../../core/theme/ownerThemes';
import { Button, HowTo, NoData } from '../../core/ui';
import o from './owner.module.css';

type Store = ReturnType<typeof supabaseOwnerThemes>;
type Raw = Record<string, unknown>;

const PICTURE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const extOf = (f: File) => ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' })[f.type] ?? 'bin';
const ORNAMENT_LABEL: Record<Ornament, string> = { hearts: 'Hearts', bubbles: 'Speech-bubble notes', 'gold-frame': 'Gold frame', lace: 'Lace' };

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
export function OwnerThemesAdmin({ store = backend ? supabaseOwnerThemes(backend) : null }: { store?: Store | null }) {
  const state = useOwnerThemes();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [preset, setPreset] = useState(OWNER_PRESETS[0]?.id ?? '');
  const [ornaments, setOrnaments] = useState<Ornament[]>(['hearts', 'bubbles']);
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

  const remove = (id: string, label: string) =>
    run(async () => {
      await edit(id, () => null);
      return `${label} is off the list. Its picture stays in the private store.`;
    });

  return (
    <div className={o.stack}>
      <section className={o.card} aria-label="Owner themes">
        <h3 className={o.cardTitle}>Owner themes</h3>
        <p className={o.note}>
          Themes only you can see and pick (Account → Theme → Only for you). They’re kept in a private store that only owner accounts can read; other accounts never
          download them.
        </p>
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
              <Button variant="quiet" disabled={busy} onClick={() => void remove(t.id, t.name)}>
                Remove {t.name}
              </Button>
            </div>
          ))}
        {note && (
          <p className={o.note} role="status">
            {note}
          </p>
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
