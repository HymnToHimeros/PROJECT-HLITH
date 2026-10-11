import type { CSSProperties, Dispatch, SetStateAction } from 'react';
import type { Character, GameContract, GameId, ModuleId } from '../../core/contract';
import { gameData } from '../../core/data/userData';
import { Button, GameTag, Segmented } from '../../core/ui';
import { BADGE_BY_ID, OWNER_TITLES, type BadgeState } from './badges';
import { BadgeMark } from './BadgeMark';
import { Switch } from './parts';
import p from './profile.module.css';
import { FEATURED_MAX, FRAME_LABEL, FRAMES, NAME_COLOR_LABEL, NAME_COLORS, PRIVACY_LABEL, TITLE_MAX, toggleFeatured, type CharRef, type Privacy, type Profile } from './profile';
import { Framed } from './ProfileCard';

interface Props {
  draft: Profile;
  setDraft: Dispatch<SetStateAction<Profile>>;
  games: GameContract[];
  characters: Record<GameId, Character[] | undefined>;
  badges: BadgeState[];
  isOwner: boolean;
  mode: 'device' | 'account';
  open: (module: ModuleId, tab?: string) => void;
}

const refKey = (r: CharRef | null) => (r ? `${r.game}:${r.id}` : '');
const parseRef = (v: string): CharRef | null => {
  const [game, id] = v.split(':');
  return game && id ? { game, id } : null;
};

/**
 * Profile → Customise (T52): the card's look (title, frame, name colour, badge), a character as
 * your picture or banner, the 4-item showcase, and what others may see. Shown inside the profile
 * editor, above the save button, with the live preview at the top of the editor.
 */
export function CardEditor({ draft, setDraft, games, characters, badges, isOwner, mode, open }: Props) {
  const owned = games.map((g) => ({ game: g, list: (characters[g.id] ?? []).filter((c) => gameData(g.id).roster[c.id]?.owned) }));
  const anyOwned = owned.some((o) => o.list.length > 0);
  const frames = FRAMES.filter((f) => f !== 'sky' || isOwner);
  const earned = badges.filter((b) => b.earned);
  const set = (change: Partial<Profile>) => setDraft((d) => ({ ...d, ...change }));
  const setPrivacy = (k: keyof Privacy, on: boolean) => setDraft((d) => ({ ...d, privacy: { ...d.privacy, [k]: on } }));
  const vent = games[0]?.vent ?? 'var(--vent-all)';

  const charSelect = (label: string, value: CharRef | null, onChange: (r: CharRef | null) => void, needArt: boolean) => (
    <label className={p.field}>
      <span className={p.fieldLabel}>{label}</span>
      <select className={p.input} value={refKey(value)} onChange={(e) => onChange(parseRef(e.target.value))} disabled={!anyOwned && !value}>
        <option value="">{needArt ? 'My own banner (or none)' : 'My own picture (or my initial)'}</option>
        {owned.map(
          ({ game, list }) =>
            list.length > 0 && (
              <optgroup key={game.id} label={game.name}>
                {list
                  .filter((c) => (needArt ? c.art || c.portrait : c.portrait))
                  .map((c) => (
                    <option key={c.id} value={`${game.id}:${c.id}`}>
                      {c.name}
                    </option>
                  ))}
              </optgroup>
            ),
        )}
      </select>
    </label>
  );

  return (
    <>
      <section className={p.editCard} aria-label="Your card">
        <h3 className={p.cardTitle}>Your card</h3>
        <label className={p.field}>
          <span className={p.fieldLabel}>
            Title <span className={p.count}>{(draft.title ?? '').length} / {TITLE_MAX}</span>
          </span>
          <input className={p.input} value={draft.title ?? ''} maxLength={TITLE_MAX} placeholder="A line under your name, e.g. “Seer of every world”" onChange={(e) => set({ title: e.target.value })} />
        </label>

        <div className={p.field}>
          <span className={p.fieldLabel}>Frame</span>
          <div className={p.frameRow} role="radiogroup" aria-label="Frame">
            {frames.map((f) => (
              <button key={f} type="button" role="radio" aria-checked={draft.frame === f} className={p.frameChoice} style={{ '--card-vent': vent } as CSSProperties} onClick={() => set({ frame: f })}>
                <Framed frame={f} src={null} letter={draft.displayName ?? '?'} size="sm" />
                <span>{FRAME_LABEL[f]}</span>
              </button>
            ))}
          </div>
          {isOwner && <span className={p.muted}>“Sky and ravens” is yours alone: nobody else can pick it, and a card shows it only for the owner.</span>}
        </div>

        <Segmented label="Name colour" value={draft.nameColor} onChange={(v) => set({ nameColor: v })} options={NAME_COLORS.map((id) => ({ id, label: NAME_COLOR_LABEL[id] }))} />

        <div className={p.field}>
          <span className={p.fieldLabel}>Badge on your card</span>
          <div className={p.frameRow} role="radiogroup" aria-label="Badge on your card">
            <button type="button" role="radio" aria-checked={draft.pinnedBadge === null} className={p.frameChoice} onClick={() => set({ pinnedBadge: null })}>
              <BadgeMark id={isOwner ? 'owner' : 'seated'} size={40} />
              <span>{isOwner ? 'My owner badge' : 'Seated on HLIÐSKJÁLF'}</span>
            </button>
            {earned
              .filter((b) => b.def.id !== 'seated' && b.def.id !== 'owner')
              .map((b) => (
                <button key={b.def.id} type="button" role="radio" aria-checked={draft.pinnedBadge === b.def.id} className={p.frameChoice} onClick={() => set({ pinnedBadge: b.def.id })}>
                  <BadgeMark id={b.def.id} size={40} />
                  <span>{b.def.name}</span>
                </button>
              ))}
          </div>
          {earned.length <= (isOwner ? 2 : 1) && <span className={p.muted}>Earn more badges to choose from: they’re listed under Badges on your profile.</span>}
        </div>

        {isOwner && (
          <div className={p.field}>
            <span className={p.fieldLabel}>Your owner badge’s name</span>
            <div className={p.chips} role="radiogroup" aria-label="Owner badge name">
              {OWNER_TITLES.map((t) => (
                <button key={t} type="button" role="radio" aria-checked={(draft.ownerTitle ?? OWNER_TITLES[0]) === t} className={p.pinChip} onClick={() => set({ ownerTitle: t })}>
                  {t}
                </button>
              ))}
            </div>
            <span className={p.muted}>{BADGE_BY_ID.owner.how}</span>
          </div>
        )}
      </section>

      <section className={p.editCard} aria-label="Character pictures">
        <h3 className={p.cardTitle}>Use a character</h3>
        <p className={p.muted}>Any character you marked as owned can be your picture or your banner. While one is chosen it shows instead of an uploaded picture; the upload is kept.</p>
        {anyOwned || draft.avatarChar || draft.bannerChar ? (
          <div className={p.twoCol}>
            {charSelect('Picture', draft.avatarChar, (r) => set({ avatarChar: r }), false)}
            {charSelect('Banner', draft.bannerChar, (r) => set({ bannerChar: r }), true)}
          </div>
        ) : (
          <div className={p.missing}>
            <span className={p.noData}>No owned characters yet</span>
            <Button variant="quiet" onClick={() => open('roster', 'characters')}>
              Open Roster
            </Button>
          </div>
        )}
      </section>

      <section className={p.editCard} aria-label="Showcase">
        <h3 className={p.cardTitle}>
          Showcase{' '}
          <span className={p.count}>
            {draft.featured.length} / {FEATURED_MAX}
          </span>
        </h3>
        <p className={p.muted}>Up to {FEATURED_MAX} favourites on your card: characters you own or teams you saved.</p>
        {games.map((g) => {
          const mine = owned.find((o) => o.game.id === g.id)?.list ?? [];
          const teams = gameData(g.id).teams;
          if (mine.length === 0 && teams.length === 0) return null;
          return (
            <div key={g.id} className={p.group}>
              <GameTag label={g.short} vent={g.vent} />
              <div className={p.chips} role="group" aria-label={`${g.short} showcase choices`}>
                {teams.map((t) => {
                  const on = draft.featured.some((f) => f.kind === 'team' && f.game === g.id && f.id === t.id);
                  return (
                    <button
                      key={`t-${t.id}`}
                      type="button"
                      className={p.pinChip}
                      aria-pressed={on}
                      disabled={!on && draft.featured.length >= FEATURED_MAX}
                      onClick={() => setDraft((d) => toggleFeatured(d, { kind: 'team', game: g.id, id: t.id }))}
                    >
                      Team · {t.name}
                    </button>
                  );
                })}
                {mine.map((c) => {
                  const on = draft.featured.some((f) => f.kind === 'character' && f.game === g.id && f.id === c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className={p.pinChip}
                      aria-pressed={on}
                      disabled={!on && draft.featured.length >= FEATURED_MAX}
                      onClick={() => setDraft((d) => toggleFeatured(d, { kind: 'character', game: g.id, id: c.id }))}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        {!anyOwned && games.every((g) => gameData(g.id).teams.length === 0) && (
          <div className={p.missing}>
            <span className={p.noData}>Nothing to show yet</span>
            <Button variant="quiet" onClick={() => open('roster', 'characters')}>
              Open Roster
            </Button>
          </div>
        )}
      </section>

      <section className={p.editCard} aria-label="Who sees your card">
        <h3 className={p.cardTitle}>Who sees your card</h3>
        <p className={p.muted}>
          Your profile is yours alone unless you switch this on. Then, when you share a team, whoever opens the link (signed in to HLITH) sees your card with it. Your bio, sign-in methods and
          backlog never show to others.
        </p>
        {mode === 'account' ? (
          <>
            <Switch label={PRIVACY_LABEL.card} checked={draft.privacy.card} onChange={(on) => setPrivacy('card', on)} />
            {(['badges', 'showcase', 'stats'] as const).map((k) => (
              <Switch key={k} label={PRIVACY_LABEL[k]} checked={draft.privacy[k]} disabled={!draft.privacy.card} onChange={(on) => setPrivacy(k, on)} />
            ))}
          </>
        ) : (
          <p className={p.muted}>Needs an account: on this device only, nothing is ever shown to anyone else.</p>
        )}
      </section>
    </>
  );
}
