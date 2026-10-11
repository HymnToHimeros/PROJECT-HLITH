import type { SupabaseClient } from '@supabase/supabase-js';
import type { OwnerThemeSource } from '../theme/ownerThemes';

/** The private bucket with the owner-only themes (0010_owner_themes.sql: owners only). */
export const OWNER_THEMES_BUCKET = 'owner-themes';

const notFound = (e: unknown) => {
  const x = e as { statusCode?: string | number; status?: number; message?: string } | null;
  return String(x?.statusCode ?? x?.status ?? '') === '404' || /not.?found/i.test(x?.message ?? '');
};

/** Reads the owner-only themes from the private bucket, as the signed-in account (storage policies decide). */
export function supabaseOwnerThemes(client: SupabaseClient): OwnerThemeSource & {
  upload(path: string, file: Blob, contentType: string): Promise<void>;
} {
  const bucket = () => client.storage.from(OWNER_THEMES_BUCKET);
  return {
    async download(path) {
      const { data, error } = await bucket().download(path);
      if (error) {
        if (notFound(error)) return null;
        throw new Error(`Couldn’t read ${path}: ${error.message}`);
      }
      return data;
    },
    async upload(path, file, contentType) {
      const { error } = await bucket().upload(path, file, { upsert: true, contentType, cacheControl: '0' });
      if (error) throw new Error(`Couldn’t save ${path}: ${error.message}`);
    },
  };
}
