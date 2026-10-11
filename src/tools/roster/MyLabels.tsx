import { useId, useState } from 'react';
import type { Character } from '../../core/contract';
import { NICKNAME_MAX, setCharacterTags, setNickname, TAG_MAX, TAGS_PER_CHARACTER, type GameUserData } from '../../core/data/userData';
import r from './roster.module.css';

/** Every tag you've used in a game, most used first (for suggestions and the Roster filter). */
export function allTags(users: GameUserData[]): string[] {
  const count = new Map<string, number>();
  for (const u of users) for (const list of Object.values(u.tags ?? {})) for (const t of list) count.set(t, (count.get(t) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
}

/**
 * Character page → Your labels (T52c): a nickname and your own tags or folders ("main team",
 * "to build"). Yours alone, saved with your game data; game list updates never touch them.
 */
export function MyLabels({ game, user, character: c }: { game: string; user: GameUserData; character: Character }) {
  const id = useId();
  const tags = user.tags?.[c.id] ?? [];
  const nickname = user.nicknames?.[c.id] ?? '';
  const [draft, setDraft] = useState('');
  const [nick, setNick] = useState(nickname);
  const suggestions = allTags([user]).filter((t) => !tags.includes(t)).slice(0, 6);
  const add = (t: string) => {
    if (!t.trim()) return;
    setCharacterTags(game, c.id, [...tags, t]);
    setDraft('');
  };
  return (
    <section className={r.labels} aria-label="Your labels">
      <label className={r.field} htmlFor={`${id}-nick`}>
        <span className={r.fieldLabel}>Nickname</span>
      </label>
      <input
        id={`${id}-nick`}
        className={r.input}
        value={nick}
        maxLength={NICKNAME_MAX}
        placeholder={`Shown instead of “${c.name}” in your roster`}
        onChange={(e) => setNick(e.target.value)}
        onBlur={() => nick.trim() !== nickname && setNickname(game, c.id, nick)}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
      <span className={r.fieldLabel} id={`${id}-tags`}>
        Your tags
      </span>
      <div className={r.tagRow} role="group" aria-labelledby={`${id}-tags`}>
        {tags.map((t) => (
          <button key={t} type="button" className={r.tagChip} aria-label={`Remove tag ${t}`} onClick={() => setCharacterTags(game, c.id, tags.filter((x) => x !== t))}>
            {t} <span aria-hidden="true">✕</span>
          </button>
        ))}
        {tags.length < TAGS_PER_CHARACTER && (
          <form
            className={r.tagAdd}
            onSubmit={(e) => {
              e.preventDefault();
              add(draft);
            }}
          >
            <input className={r.input} value={draft} maxLength={TAG_MAX} placeholder="Add a tag, e.g. main team" aria-label="New tag" onChange={(e) => setDraft(e.target.value)} />
            <button type="submit" className={r.smallBtn} disabled={!draft.trim()}>
              Add
            </button>
          </form>
        )}
      </div>
      {suggestions.length > 0 && tags.length < TAGS_PER_CHARACTER && (
        <div className={r.tagRow} aria-label="Tags you used before">
          {suggestions.map((t) => (
            <button key={t} type="button" className={r.tagSuggest} onClick={() => add(t)}>
              + {t}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
