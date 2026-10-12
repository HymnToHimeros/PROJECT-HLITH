import { useState } from 'react';
import o from './owner.module.css';

/*
 * A leak post a job found on a channel (e.g. Seele on Telegram, docs/ROUTINES.md step 3),
 * inside its finding: the English first when the post was translated (marked "may be
 * inexact"), with "Show original"; images by link only, never copied.
 */

export interface PostPayload {
  url?: string;
  at?: string;
  text: string;
  translation?: string;
  images: string[];
}

/** The `post` part of a finding's payload, or null when it has none. */
export function postOf(payload: Record<string, unknown>): PostPayload | null {
  const p = payload.post;
  if (!p || typeof p !== 'object') return null;
  const r = p as Record<string, unknown>;
  if (typeof r.text !== 'string' || !r.text.trim()) return null;
  const s = (v: unknown) => (typeof v === 'string' && v.trim() ? v : undefined);
  const translation = s(r.translation);
  const url = s(r.url);
  const at = s(r.at);
  return {
    text: r.text,
    images: Array.isArray(r.images) ? r.images.filter((x): x is string => typeof x === 'string' && /^https:\/\//.test(x)) : [],
    ...(translation ? { translation } : {}),
    ...(url ? { url } : {}),
    ...(at ? { at } : {}),
  };
}

export function LeakPost({ post }: { post: PostPayload }) {
  const [original, setOriginal] = useState(false);
  const translated = Boolean(post.translation);
  const shown = translated && !original ? post.translation : post.text;
  return (
    <div className={o.post}>
      {translated && <span className={o.recordMeta}>{original ? 'Original post' : 'Translated, may be inexact'}</span>}
      <p className={o.postText} lang={translated && original ? 'zh' : undefined}>
        {shown}
      </p>
      {translated && (
        <button type="button" className={o.smallBtn} onClick={() => setOriginal((v) => !v)} aria-pressed={original}>
          {original ? 'Show translation' : 'Show original'}
        </button>
      )}
      {post.images.length > 0 && (
        <span className={o.recordMeta}>
          Images:{' '}
          {post.images.map((src, i) => (
            <a key={src} className={o.link} href={src} target="_blank" rel="noreferrer noopener">
              {i ? `, ${i + 1}` : '1'}
            </a>
          ))}
        </span>
      )}
    </div>
  );
}
