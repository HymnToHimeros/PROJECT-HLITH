/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

/** Heading fonts a theme can load on demand (core/theme/skin.ts). */
declare module '@fontsource/*';
