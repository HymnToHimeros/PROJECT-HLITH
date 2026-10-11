import { useLayoutEffect, useRef } from 'react';

/**
 * A sliding "you are here" marker (T50): measures the active item inside a list (the sidebar's
 * modules, the phone's bottom bar) and sets its position on the list as CSS variables, so one
 * marker drawn by the list glides from item to item instead of jumping.
 * --glide-x / --glide-y / --glide-w / --glide-h, in px relative to the list; data-glide="on" once set.
 */
export function useGlide<T extends HTMLElement>(selector: string, deps: unknown[]) {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const list = ref.current;
    if (!list) return;
    const place = () => {
      const el = list.querySelector<HTMLElement>(selector);
      if (!el) {
        delete list.dataset.glide;
        return;
      }
      const box = list.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      list.style.setProperty('--glide-x', `${r.left - box.left + list.scrollLeft}px`);
      list.style.setProperty('--glide-y', `${r.top - box.top + list.scrollTop}px`);
      list.style.setProperty('--glide-w', `${r.width}px`);
      list.style.setProperty('--glide-h', `${r.height}px`);
      list.dataset.glide = 'on';
    };
    place();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(place) : null;
    ro?.observe(list);
    return () => ro?.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}
