/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { appShell } from './appShell';

// Tool settings live in config/; the app itself is the project root.
const here = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: fileURLToPath(new URL('..', import.meta.url)),
  envDir: here,
  // appShell: the service worker that lets the installed app open offline (T45).
  plugins: [react(), appShell()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    // Unit tests run in "this device only" mode; sign-in is tested with fakes.
    env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '' },
  },
});
