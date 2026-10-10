import type { SupabaseClient } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';
import { backend } from '../../core/data/backend';
import { dataUrlToBlob, EMPTY_PROFILE, fromRow, isBlank, loadDeviceProfile, saveDeviceProfile, storagePath, toRow, type Profile, type ProfileRow } from './profile';

export const AVATAR_BUCKET = 'avatars';

/** Where the profile is kept: this browser, or your account. */
export interface ProfileStore {
  mode: 'device' | 'account';
  /** Two stores with the same key hold the same profile (so a save in one shows in the other). */
  key?: string;
  load(): Promise<Profile>;
  save(p: Profile): Promise<Profile>;
  /** Something an <img> can show for a stored picture value. */
  imageUrl(value: string | null, version?: number): string | null;
}

export const deviceStore: ProfileStore = {
  mode: 'device',
  key: 'device',
  load: async () => loadDeviceProfile(),
  save: async (p) => saveDeviceProfile(p),
  imageUrl: (v) => v,
};

/** Signed in: public.profiles (own row only, row-level security) + the avatars bucket (own folder only). */
export function accountStore(client: SupabaseClient, userId: string): ProfileStore {
  const bucket = () => client.storage.from(AVATAR_BUCKET);
  const upload = async (value: string | null, kind: 'avatar' | 'banner'): Promise<string | null> => {
    if (!value?.startsWith('data:')) return value;
    const blob = dataUrlToBlob(value);
    const path = storagePath(userId, kind, blob.type);
    const { error } = await bucket().upload(path, blob, { upsert: true, contentType: blob.type, cacheControl: '3600' });
    if (error) throw new Error(`The picture didn’t upload: ${error.message}`);
    return path;
  };
  return {
    mode: 'account',
    key: `account:${userId}`,
    async load() {
      const { data, error } = await client.from('profiles').select('user_id, display_name, bio, avatar_path, banner_path, showcase, updated_at').eq('user_id', userId).maybeSingle();
      if (error) throw new Error(error.message);
      return fromRow(data as Partial<ProfileRow> | null);
    },
    async save(p) {
      const withPaths: Profile = { ...p, avatar: await upload(p.avatar, 'avatar'), banner: await upload(p.banner, 'banner'), updatedAt: Date.now() };
      const { error } = await client.from('profiles').upsert(toRow(withPaths, userId));
      if (error) throw new Error(error.message);
      return withPaths;
    },
    imageUrl(value, version) {
      if (!value) return null;
      if (value.startsWith('data:') || /^https?:/.test(value)) return value;
      const url = bucket().getPublicUrl(value).data.publicUrl;
      return version ? `${url}?v=${version}` : url;
    },
  };
}

export function storeFor(userId: string | undefined): ProfileStore {
  return backend && userId ? accountStore(backend, userId) : deviceStore;
}

export interface ProfileState {
  profile: Profile;
  loading: boolean;
  error: string;
  mode: ProfileStore['mode'];
  save: (p: Profile) => Promise<boolean>;
  imageUrl: (value: string | null) => string | null;
  /** Signed in with an empty account profile, but this device holds one: offered to copy over (never copied without asking). */
  deviceCopy: Profile | null;
  /** "Keep my account's profile": stop offering the device copy here. The device copy itself is kept. */
  dismissDeviceCopy: () => void;
}

/** Remembered on this device: you chose to keep your account's profile over this device's copy. */
export const DEVICE_COPY_DISMISSED_KEY = 'hlith.profile.deviceCopyDismissed';
const readDismissed = (): boolean => {
  try {
    return localStorage.getItem(DEVICE_COPY_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
};

/** Every open copy of the profile (the Account page, the sidebar card) hears about a save. */
type Listener = (store: ProfileStore, saved: Profile) => void;
const listeners = new Set<Listener>();
const sameStore = (a: ProfileStore, b: ProfileStore) => a === b || (a.key !== undefined && a.key === b.key);

export function useProfile(store: ProfileStore): ProfileState {
  const [state, setState] = useState<{ store: ProfileStore; profile: Profile; error: string } | null>(null);
  const [saveError, setSaveError] = useState('');
  const [dismissed, setDismissed] = useState(readDismissed);
  const dismissDeviceCopy = useCallback(() => {
    try {
      localStorage.setItem(DEVICE_COPY_DISMISSED_KEY, '1');
    } catch {
      /* storage blocked: hidden for this visit only */
    }
    setDismissed(true);
  }, []);

  useEffect(() => {
    let alive = true;
    store.load().then(
      (profile) => alive && setState({ store, profile, error: '' }),
      (e: unknown) => alive && setState({ store, profile: EMPTY_PROFILE, error: e instanceof Error ? e.message : 'Your profile didn’t load.' }),
    );
    return () => {
      alive = false;
    };
  }, [store]);

  useEffect(() => {
    const hear: Listener = (from, saved) => {
      if (sameStore(from, store)) setState({ store, profile: saved, error: '' });
    };
    listeners.add(hear);
    return () => {
      listeners.delete(hear);
    };
  }, [store]);

  const current = state?.store === store ? state : null;
  const save = useCallback(
    async (p: Profile) => {
      setSaveError('');
      try {
        const saved = await store.save(p);
        setState({ store, profile: saved, error: '' });
        for (const hear of listeners) hear(store, saved);
        return true;
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : 'That didn’t save. Nothing was changed.');
        return false;
      }
    },
    [store],
  );
  const profile = current?.profile ?? EMPTY_PROFILE;
  const local = store.mode === 'account' && !dismissed && current && !current.error && isBlank(profile) ? loadDeviceProfile() : null;
  return {
    profile,
    loading: current === null,
    error: saveError || current?.error || '',
    mode: store.mode,
    save,
    imageUrl: (v) => store.imageUrl(v, profile.updatedAt),
    deviceCopy: local && !isBlank(local) ? local : null,
    dismissDeviceCopy,
  };
}
