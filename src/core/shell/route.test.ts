import { describe, expect, it } from 'vitest';
import { parseRoute, routePath } from './route';

describe('routes with tabs', () => {
  it('reads the tab from the address for any module', () => {
    expect(parseRoute('/hsr/pulls/log')).toEqual({ scope: 'hsr', module: 'pulls', tab: 'log' });
    expect(parseRoute('/hsr/roster/teams')).toEqual({ scope: 'hsr', module: 'roster', tab: 'teams' });
    expect(parseRoute('/all/today')).toEqual({ scope: 'all', module: 'today', tab: null });
    expect(parseRoute('/hsr/nope/log')).toEqual({ scope: 'hsr', module: null, tab: null });
  });

  it('writes the tab only when there is one', () => {
    expect(routePath('hsr', 'pulls', 'calculator')).toBe('/hsr/pulls/calculator');
    expect(routePath('hsr', 'pulls', null)).toBe('/hsr/pulls');
    expect(routePath('zzz', 'roster')).toBe('/zzz/roster');
  });
});
