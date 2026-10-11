import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useGlide } from './useGlide';

function Menu({ active }: { active: number }) {
  const ref = useGlide<HTMLElement>('[aria-current="page"]', [active]);
  return (
    <nav ref={ref} aria-label="m">
      {[0, 1, 2].map((i) => (
        <a key={i} aria-current={i === active ? 'page' : undefined} data-i={i}>
          {i}
        </a>
      ))}
    </nav>
  );
}

describe('the sliding “you are here” marker (T50)', () => {
  it('puts the active item’s place on the menu as CSS variables, and follows it', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const i = Number(this.dataset.i ?? -1);
      return (i < 0 ? { left: 10, top: 100, width: 200, height: 300 } : { left: 10, top: 100 + i * 40, width: 200, height: 36 }) as DOMRect;
    });
    const { container, rerender } = render(<Menu active={1} />);
    const nav = container.querySelector('nav') as HTMLElement;
    expect(nav.dataset.glide).toBe('on');
    expect(nav.style.getPropertyValue('--glide-y')).toBe('40px');
    expect(nav.style.getPropertyValue('--glide-h')).toBe('36px');
    rerender(<Menu active={2} />);
    expect(nav.style.getPropertyValue('--glide-y')).toBe('80px');
    rerender(<Menu active={-1} />);
    expect(nav.dataset.glide).toBeUndefined();
    vi.restoreAllMocks();
  });
});
