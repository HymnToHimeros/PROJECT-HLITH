import { useState } from 'react';
import type { PostPayload } from '../intel/leakNotes';
import o from './owner.module.css';

/*
 * A leak post a job found on a channel (e.g. Seele on Telegram, docs/ROUTINES.md step 3),
 * inside its finding: the English first when the post was translated (marked "may be
 * inexact"), with "Show original"; images by link only, never copied.
 */

export { postOf, type PostPayload } from '../intel/leakNotes';

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
