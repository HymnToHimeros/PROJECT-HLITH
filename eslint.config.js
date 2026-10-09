import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

// Mirrors tests/architecture.test.ts so the editor flags it before the build does.
const noGames = {
  group: ['**/games', '**/games/**', '@/games', '@/games/**'],
  message: 'core/ and tools/ never import from games/. Wire games in src/main.tsx.',
};

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'docs', 'test-results', 'playwright-report'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: { ...reactHooks.configs.recommended.rules },
  },
  {
    files: ['tests/**/*.ts', 'scripts/**/*.ts', '*.config.{ts,js}'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['src/tools/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: [noGames] }] },
  },
  {
    files: ['src/core/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            noGames,
            { group: ['**/tools', '**/tools/**', '@/tools/**'], message: 'core/ never imports from tools/.' },
          ],
        },
      ],
    },
  },
);
