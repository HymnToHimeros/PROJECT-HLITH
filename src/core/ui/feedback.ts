/**
 * Customise → Feedback (T52d): a short buzz on phones and a soft sound when you tick a task,
 * mark something done or owned. Both off unless you switch them on; nothing plays otherwise.
 * Sounds are made in the browser (no files to load) and stay quiet: one short, soft note.
 */
import { getPrefs } from '../data/prefs';

export type FeedbackKind = 'done' | 'undo';

let audio: AudioContext | null = null;

function tone(kind: FeedbackKind): void {
  const Ctx = typeof window !== 'undefined' ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) : undefined;
  if (!Ctx) return;
  try {
    audio ??= new Ctx();
    const t = audio.currentTime;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = 'sine';
    // Done: a small rising note. Undo: a small falling one.
    osc.frequency.setValueAtTime(kind === 'done' ? 660 : 520, t);
    osc.frequency.exponentialRampToValueAtTime(kind === 'done' ? 990 : 390, t + 0.12);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.06, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    osc.connect(gain).connect(audio.destination);
    osc.start(t);
    osc.stop(t + 0.2);
  } catch {
    /* audio not allowed here: stay silent */
  }
}

/** Plays the feedback you switched on (if any). Safe to call anywhere. */
export function feedback(kind: FeedbackKind = 'done'): void {
  const f = getPrefs().feedback;
  if (f?.haptics && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(kind === 'done' ? 12 : [6, 40, 6]);
  if (f?.sounds) tone(kind);
}
