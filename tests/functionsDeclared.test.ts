// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The Supabase GitHub integration deploys only the server functions declared in
// supabase/config.toml. A function folder without its [functions.<name>] entry merges
// green but never goes live, so every folder (except _shared) must be declared.
describe('server functions are declared for deploy', () => {
  it('every supabase/functions folder has a [functions.<name>] entry in config.toml', () => {
    const config = readFileSync('supabase/config.toml', 'utf8');
    const folders = readdirSync('supabase/functions', { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
      .map((d) => d.name);
    expect(folders.length).toBeGreaterThan(0);
    const missing = folders.filter((name) => !config.includes(`[functions.${name}]`));
    expect(missing).toEqual([]);
  });
});
