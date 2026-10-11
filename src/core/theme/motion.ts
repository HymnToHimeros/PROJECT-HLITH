/**
 * Animations (owner's T50): on, reduced or off, applied as <html data-motion="…">. Every
 * animation and transition in the app keys off that attribute (tokens.css, art.module.css):
 * - on: everything moves (quick, transform and opacity only, so it stays cheap on phones);
 * - reduced: things still fade, but nothing slides, turns, floats or sways;
 * - off: nothing animates at all.
 * Not chosen yet = follow the device: reduced when it asks for less motion, else on.
 */
import { useEffect } from 'react';
import { getPrefs, updatePrefs, usePrefs } from '../data/prefs';

export type Motion = 'on' | 'reduced' | 'off';
export const MOTIONS: readonly Motion[] = ['on', 'reduced', 'off'];

const deviceWantsLess = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

/** What applies now: your choice, else what the device asks for. */
export const motionFor = (choice: unknown): Motion => (MOTIONS.includes(choice as Motion) ? (choice as Motion) : deviceWantsLess() ? 'reduced' : 'on');

export function applyMotion(choice: unknown): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.motion = motionFor(choice);
}

/** Keeps <html data-motion> in step with the setting and, while it follows the device, with the device. */
export function useMotion(): Motion {
  const choice = usePrefs().motion;
  useEffect(() => {
    applyMotion(choice);
    if (choice) return;
    const q = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const on = () => applyMotion(undefined);
    q?.addEventListener?.('change', on);
    return () => q?.removeEventListener?.('change', on);
  }, [choice]);
  return motionFor(choice);
}

export const savedMotion = () => getPrefs().motion;

/** Account → Theme → Animations. `undefined` goes back to following the device. */
export function setMotion(motion: Motion | undefined): void {
  updatePrefs((p) => {
    const next = { ...p };
    if (motion) next.motion = motion;
    else delete next.motion;
    return next;
  });
  applyMotion(motion);
}
