import type { SupabaseClient } from '@supabase/supabase-js';
import type { Prefs } from './prefs';
import type { GameDataCopy, GameDataStore, SettingsStore } from './sync';

/** Settings kept in public.user_settings, one row per user (row-level security keeps it private). */
export function supabaseSettings(client: SupabaseClient, userId: string): SettingsStore {
  return {
    async load() {
      const { data, error } = await client.from('user_settings').select('data, updated_at').eq('user_id', userId).maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      const prefs = data.data as Prefs;
      return { data: prefs, updatedAt: prefs.updatedAt ?? Date.parse(data.updated_at as string) };
    },
    async save(prefs) {
      const { error } = await client
        .from('user_settings')
        .upsert({ user_id: userId, data: prefs, updated_at: new Date(prefs.updatedAt || Date.now()).toISOString() });
      if (error) throw new Error(error.message);
    },
  };
}

/** Your game data in public.user_game_data, one row per user (row-level security keeps it private). */
export function supabaseGameData(client: SupabaseClient, userId: string): GameDataStore {
  return {
    async load() {
      const { data, error } = await client.from('user_game_data').select('data, updated_at').eq('user_id', userId).maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      const copy = data.data as Partial<GameDataCopy>;
      return { version: 1, games: copy.games ?? {}, updatedAt: copy.updatedAt ?? Date.parse(data.updated_at as string) };
    },
    async save(copy) {
      const { error } = await client.from('user_game_data').upsert({ user_id: userId, data: copy, updated_at: new Date(copy.updatedAt || Date.now()).toISOString() });
      if (error) throw new Error(error.message);
    },
  };
}
