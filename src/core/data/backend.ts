/**
 * The connection to Supabase. Absent settings = "this device only" mode: the app
 * works fully, nothing leaves the browser, and the shell says so.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const backend: SupabaseClient | null = url && key ? createClient(url, key, { auth: { persistSession: true, detectSessionInUrl: true } }) : null;
