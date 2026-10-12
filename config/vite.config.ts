/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { appShell } from './appShell.ts';
import { legalPages } from './legal/pages.ts';

// Tool settings live in config/; the app's page (index.html) lives in src/, and the
// project root keeps public/, dist/ and the tests.
const here = fileURLToPath(new URL('.', import.meta.url));
const project = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig({
  root: fileURLToPath(new URL('../src', import.meta.url)),
  publicDir: fileURLToPath(new URL('../public', import.meta.url)),
  envDir: here,
  build: { outDir: fileURLToPath(new URL('../dist', import.meta.url)), emptyOutDir: true },
  // appShell: the service worker that lets the installed app open offline (T45).
  // legalPages: /about, /privacy and /terms as plain HTML that opens without signing in (T55).
  plugins: [react(), appShell(), legalPages()],
  test: {
    root: project,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    // Unit tests run in "this device only" mode; sign-in is tested with fakes.
    env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '' },
  },
});
