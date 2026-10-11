import { useState } from 'react';
import { backend } from '../../core/data/backend';
import { supabaseOwnerThemes } from '../../core/data/ownerThemesSource';
import { loadOwnerThemes, readOwnerManifest, useOwnerThemes } from '../../core/theme/ownerThemes';
import { Button, HowTo, NoData } from '../../core/ui';
import o from './owner.module.css';

type Store = ReturnType<typeof supabaseOwnerThemes>;

const PICTURE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const extOf = (f: File) => ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' })[f.type] ?? 'bin';
const typeOf = (name: string) =>
  name.endsWith('.json') ? 'application/json' : name.endsWith('.svg') ? 'image/svg+xml' : name.endsWith('.png') ? 'image/png' : name.endsWith('.webp') ? 'image/webp' : name.endsWith('.gif') ? 'image/gif' : 'image/jpeg';

/** The manifest as stored (kept as-is, so fields this page doesn't know survive an edit). */
async function rawManifest(store: Store): Promise<{ themes: Record<string, unknown>[] }> {
  const blob = await store.download('manifest.json');
  if (!blob) return { themes: [] };
  const raw = JSON.parse(await blob.text()) as { themes?: unknown };
  return { ...(raw as object), themes: Array.isArray(raw.themes) ? (raw.themes as Record<string, unknown>[]) : [] };
}

/**
 * Owner console → Owner themes (T47): the owner-only themes kept in the private store. Upload a
 * theme pack (manifest.json and the scene files it names), and give any theme a picture of your
 * own, shown instead of its drawn scene. Everything goes to the private bucket only owners can
 * read; nothing here is in the app's public code.
 */
export function OwnerThemesAdmin({ store = backend ? supabaseOwnerThemes(backend) : null }: { store?: Store | null }) {
  const state = useOwnerThemes();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
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

  const uploadPack = (files: File[]) =>
    run(async () => {
      const manifestFile = files.find((f) => f.name === 'manifest.json');
      if (!manifestFile) throw new Error('A theme pack needs its manifest.json.');
      const raw = JSON.parse(await manifestFile.text()) as unknown;
      const { themes, problems } = readOwnerManifest(raw);
      if (!themes.length) throw new Error(`Nothing usable in manifest.json. ${problems.join(' ')}`);
      // Each other file goes where the manifest names it (matched by file name).
      const wanted = new Map(themes.flatMap((t) => [t.scene, t.picture]).filter((p): p is string => Boolean(p)).map((p) => [p.split('/').pop() as string, p]));
      const skipped: string[] = [];
      for (const f of files) {
        if (f === manifestFile) continue;
        const path = wanted.get(f.name);
        if (!path) skipped.push(f.name);
        else await store.upload(path, f, typeOf(f.name));
      }
      await store.upload('manifest.json', manifestFile, 'application/json');
      return [`Saved ${themes.length} theme${themes.length === 1 ? '' : 's'}.`, skipped.length ? `Not named in the manifest, left out: ${skipped.join(', ')}.` : '', problems.join(' ')]
        .filter(Boolean)
        .join(' ');
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
      const raw = await rawManifest(store);
      const themes = raw.themes.map((t) => {
        if (t.id !== id) return t;
        const rest = { ...t };
        delete rest.picture;
        return path ? { ...rest, picture: path } : rest;
      });
      await store.upload('manifest.json', new Blob([JSON.stringify({ ...raw, themes }, null, 2)], { type: 'application/json' }), 'application/json');
      return file ? 'Picture saved. It shows instead of the drawn scene.' : 'Back to the drawn scene.';
    });

  return (
    <div className={o.stack}>
      <section className={o.card} aria-label="Owner themes">
        <h3 className={o.cardTitle}>Owner themes</h3>
        <p className={o.note}>
          Themes only you can see and pick (Account → Theme → Only for you). They’re kept in a private store that only owner accounts can read, and other accounts never
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
            <NoData dash={false} /> No owner themes yet. Upload a theme pack below.
          </p>
        )}
        {state.status === 'ready' &&
          state.themes.map((t) => (
            <div key={t.id} className={o.ownerThemeRow}>
              <span className={o.ownerThemeThumb} style={t.pictureUrl || t.sceneUrl ? { backgroundImage: `url(${t.pictureUrl ?? t.sceneUrl})` } : undefined} aria-hidden="true" />
              <span className={o.ownerThemeText}>
                <strong>{t.name}</strong>
                <span className={o.note}>{t.picture ? 'Your picture' : t.scene ? 'Drawn scene' : 'Colours only'}</span>
              </span>
              <label className={o.fileButton}>
                {t.picture ? 'Change picture' : 'Use my picture'}
                <input className={o.fileInput} type="file" accept={PICTURE_TYPES.join(',')} disabled={busy} onChange={(e) => e.target.files?.[0] && void setPicture(t.id, e.target.files[0])} />
              </label>
              {t.picture && (
                <Button variant="quiet" disabled={busy} onClick={() => void setPicture(t.id, null)}>
                  Use the drawn scene
                </Button>
              )}
            </div>
          ))}
        <label className={o.fileButton}>
          Upload a theme pack
          <input className={o.fileInput} type="file" multiple accept=".json,.svg,.png,.jpg,.jpeg,.webp,.gif" disabled={busy} onChange={(e) => e.target.files && void uploadPack([...e.target.files])} />
        </label>
        {note && (
          <p className={o.note} role="status">
            {note}
          </p>
        )}
      </section>
      <HowTo
        steps={[
          'A theme pack is manifest.json plus the scene files it names; pick them all at once with “Upload a theme pack”. Uploading again replaces them.',
          '“Use my picture” puts a picture of your own behind that theme instead of its drawn scene. Only you can see it.',
          'Choose the theme in Account → Theme → Only for you.',
        ]}
      />
    </div>
  );
}
