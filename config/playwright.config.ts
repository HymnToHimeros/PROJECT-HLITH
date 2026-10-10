import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// Cloud sessions ship a pre-installed Chromium; CI installs its own.
const localChromium = '/opt/pw-browsers/chromium';
const PORT = Number(process.env.E2E_PORT ?? 4400);

export default defineConfig({
  testDir: '../tests/e2e',
  // Every test on its own, so CI can split them over several machines (--shard).
  fullyParallel: true,
  use: {
    baseURL: `http://localhost:${PORT}`,
    launchOptions: existsSync(localChromium) ? { executablePath: localChromium } : {},
  },
  projects: [
    { name: 'pc', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    // Browser tests run without the live project ("this device only" mode).
    command: `VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= npm run build && npm run preview -- --port ${PORT} --strictPort`,
    port: PORT,
    timeout: 180_000, // the build can be slow on a busy machine
    // Always this checkout's own fresh build, never another copy's server that happens to be running.
    reuseExistingServer: false,
  },
});
