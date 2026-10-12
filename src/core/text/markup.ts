/**
 * Turning game and wiki text with markup into plain words, in one place for the app and the
 * import scripts. Each removal repeats until nothing more is found, so markup hidden inside
 * other markup ("<<b>i>", "<!<!---->--") can't survive one pass and come back together.
 */

/** Every <tag> removed, or only the named ones (`<color=#fff>…</color>` with ['color']). */
export function stripTags(text: string, only?: readonly string[]): string {
  const tag = only?.length ? new RegExp(String.raw`<\/?(?:${only.join('|')})\b[^<>]*>`, 'g') : /<[^<>]*>/g;
  let before: string;
  do {
    before = text;
    text = text.replace(tag, '');
  } while (text !== before);
  return text;
}

/** HTML/wiki comments removed with what they hold (browsers also end one at "--!>"); a stray "<!--" or "-->" left over is dropped too. */
export function stripComments(text: string): string {
  let before: string;
  do {
    before = text;
    text = text.replace(/<!--[\s\S]*?--!?>/g, '');
  } while (text !== before);
  return unwrapComments(text);
}

/** Only the comment marks removed, keeping what was inside (wiki pages hide live totals in comments). */
export function unwrapComments(text: string): string {
  let before: string;
  do {
    before = text;
    text = text.replace(/<!--|--!?>/g, '');
  } while (text !== before);
  return text;
}
