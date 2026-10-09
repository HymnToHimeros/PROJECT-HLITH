// @vitest-environment node
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkFile, checkTree } from './lib/import-rules';

const SRC = resolve(__dirname, '../src');
const at = (p: string) => resolve(SRC, p);

describe('architecture: skeleton, shelves, flesh', () => {
  it('the real source tree breaks no import rule', () => {
    expect(checkTree(SRC)).toEqual([]);
  });
});

describe('the import checker itself', () => {
  const rules = (file: string, code: string) => checkFile(SRC, at(file), code).map((v) => v.rule);

  it('stops core/ and tools/ importing a game', () => {
    expect(rules('core/registry/games.ts', `import { hsr } from '../../games/hsr/contract';`)).toEqual([
      'core/ may not import from games/',
    ]);
    expect(rules('tools/pulls/Planner.tsx', `import type { X } from "@/games/zzz/rules"`)).toEqual([
      'tools/ may not import from games/',
    ]);
  });

  it('stops core/ and tools/ importing the list of games', () => {
    expect(rules('core/shell/Shell.tsx', `import { games } from '../../games';`)).toEqual([
      'core/ may not import from games/',
    ]);
  });

  it('catches multi-line, re-export, side-effect, dynamic and require forms', () => {
    const code = [
      `import {\n  a,\n  b,\n} from '../../games/hsr/contract';`,
      `export * from '../../games/zzz/contract';`,
      `import '../../games/hsr/data/style.css';`,
      `const m = import('../../games/hsr/rules');`,
      'const n = import(`../../games/${id}/contract`);',
      `const o = require('../../games/zzz/rules');`,
    ].join('\n');
    expect(rules('tools/budget/engine.ts', code)).toHaveLength(6);
  });

  it('stops core/ importing tools/', () => {
    expect(rules('core/shell/Shell.tsx', `import x from '../../tools/today/Today';`)).toEqual([
      'core/ may not import from tools/',
    ]);
  });

  it('keeps games apart from tools/ and from each other', () => {
    expect(rules('games/hsr/rules.ts', `import { budget } from '../../tools/budget';`)).toEqual([
      'games/ may not import from tools/ (games are data + rules)',
    ]);
    expect(rules('games/hsr/rules.ts', `import { x } from '../zzz/rules';`)).toEqual([
      'games/hsr may not import from games/zzz',
    ]);
  });

  it('allows the right directions', () => {
    expect(rules('games/hsr/contract.ts', `import type { GameContract } from '../../core/contract';`)).toEqual([]);
    expect(rules('games/hsr/contract.ts', `import data from './data/characters.json';`)).toEqual([]);
    expect(rules('tools/today/Today.tsx', `import { StatTile } from '../../core/ui/StatTile';`)).toEqual([]);
    expect(rules('core/ui/StatTile.tsx', `import { useState } from 'react';`)).toEqual([]);
    expect(rules('main.tsx', `import { games } from './games';`)).toEqual([]);
  });
});
