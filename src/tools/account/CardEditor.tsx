import { lazy, Suspense, type CSSProperties, type Dispatch, type SetStateAction } from 'react';
import type { Character, GameContract, GameId, ModuleId } from '../../core/contract';
import { gameData } from '../../core/data/userData';
import { Button, GameTag, Segmented } from '../../core/ui';
import { BADGE_BY_ID, OWNER_TITLES, type BadgeState } from './badges';
import { BadgeMark } from './BadgeMark';
import { Switch } from './parts';
import p from './profile.module.css';
import { FEATURED_MAX, FRAME_LABEL, FRAMES, NAME_COLOR_LABEL, NAME_COLORS, PRIVACY_LABEL, SHELF_MAX, TITLE_MAX, toggleFeatured, type CharRef, type Privacy, type Profile } from './profile';
import { Framed } from './ProfileCard';
import type { HeldReward } from './rewards/model';
import { RewardsEditor } from './rewards/RewardsEditor';
import { serverRewards } from './rewards/rewardsData';
import { EARNED_TITLE } from './titles';
import { THEMES } from '../../core/theme/themes';

// The owner's own section, with its drawings, loads only for the owner (T64).
const OwnerLookEditor = lazy(() => import('./ownerArt/OwnerLookEditor'));

interface Props {
  draft: Profile;
  setDraft: Dispatch<SetStateAction<Profile>>;
  games: GameContract[];
  characters: Record<GameId, Character[] | undefined>;
  badges: BadgeState[];
  isOwner: boolean;
  mode: 'device' | 'account';
  open: (module: ModuleId, tab?: string) => void;
  /** T67: the rewards you hold. */
  held?: HeldReward[];
  onClaimed?: () => void;
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
export function CardEditor({ draft, setDraft, games, characters, badges, isOwner, mode, open, held = [], onClaimed = () => {} }: Props) {
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
          <span className={p.fieldLabel}>Earned title</span>
          <div className={p.chips} role="radiogroup" aria-label="Earned title">
            <button type="button" role="radio" aria-checked={draft.titleBadge === null} className={p.pinChip} onClick={() => set({ titleBadge: null })}>
              My typed title
            </button>
            {earned
              .filter((b) => EARNED_TITLE[b.def.id])
              .map((b) => (
                <button key={b.def.id} type="button" role="radio" aria-checked={draft.titleBadge === b.def.id} className={p.pinChip} onClick={() => set({ titleBadge: b.def.id })}>
                  {EARNED_TITLE[b.def.id]}
                </button>
              ))}
          </div>
          <span className={p.muted}>Each comes with a badge you hold, and shows with a ✔. If you lose the badge, your typed title shows again.</span>
        </div>

        <div className={p.twoCol}>
          <label className={p.field}>
            <span className={p.fieldLabel}>Favourite game</span>
            <select className={p.input} value={draft.favGame ?? ''} onChange={(e) => set({ favGame: e.target.value || null })}>
              <option value="">None</option>
              {games.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <label className={p.field}>
            <span className={p.fieldLabel}>Card background</span>
            <select className={p.input} value={draft.cardBackground ?? ''} onChange={(e) => set({ cardBackground: (THEMES.find((t) => t.id === e.target.value)?.id ?? null) })}>
              <option value="">Game colours</option>
              {THEMES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} theme art
                </option>
              ))}
            </select>
          </label>
        </div>
        <span className={p.muted}>The card background shows behind your card when you have no banner picture.</span>

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

        <div className={p.field}>
          <span className={p.fieldLabel}>
            Badge shelf{' '}
            <span className={p.count}>
              {draft.pinnedShelf.length} / {SHELF_MAX}
            </span>
          </span>
          <div className={p.chips} role="group" aria-label="Badge shelf">
            {earned
              .filter((b) => b.def.id !== 'owner')
              .map((b) => {
                const on = draft.pinnedShelf.includes(b.def.id);
                return (
                  <button
                    key={b.def.id}
                    type="button"
                    className={p.pinChip}
                    aria-pressed={on}
                    disabled={!on && draft.pinnedShelf.length >= SHELF_MAX}
                    onClick={() => set({ pinnedShelf: on ? draft.pinnedShelf.filter((x) => x !== b.def.id) : [...draft.pinnedShelf, b.def.id] })}
                  >
                    <BadgeMark id={b.def.id} size={26} />
                    {b.def.name}
                  </button>
                );
              })}
          </div>
          <span className={p.muted}>Up to {SHELF_MAX} favourites next to your main badge. A badge you no longer hold leaves the shelf by itself.</span>
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

      {isOwner && (
        <Suspense fallback={<p className={p.muted}>Loading your owner look…</p>}>
          <OwnerLookEditor value={draft.ownerStyle} onChange={(ownerStyle) => set({ ownerStyle })} name={draft.displayName ?? ''} />
        </Suspense>
      )}

      <RewardsEditor held={held} worn={draft.rewards} onWear={(rewards) => set({ rewards })} signedIn={mode === 'account'} api={serverRewards} onClaimed={onClaimed} name={draft.displayName ?? ''} />

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
        {games.some((g) => gameData(g.id).teams.length > 0) && (
          <label className={p.field}>
            <span className={p.fieldLabel}>Best team</span>
            <select className={p.input} value={refKey(draft.bestTeam)} onChange={(e) => set({ bestTeam: parseRef(e.target.value) })}>
              <option value="">No best team</option>
              {games.map((g) =>
                gameData(g.id).teams.length > 0 ? (
                  <optgroup key={g.id} label={g.name}>
                    {gameData(g.id).teams.map((t) => (
                      <option key={t.id} value={`${g.id}:${t.id}`}>
                        {t.name}
                      </option>
                    ))}
                  </optgroup>
                ) : null,
              )}
            </select>
          </label>
        )}
        <p className={p.muted}>Your luckiest pull shows by itself once you import pull history: the top result that came after the fewest pulls, proven from that history.</p>
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
          Your profile is yours alone unless you switch this on. Then, when you share a team, whoever opens the link (signed in to HLITH) sees your card with it. Your sign-in methods and backlog never
          show to others; your bio only if you switch it on below.
        </p>
        {mode === 'account' ? (
          <>
            <Switch label={PRIVACY_LABEL.card} checked={draft.privacy.card} onChange={(on) => setPrivacy('card', on)} />
            {(['badges', 'showcase', 'luck', 'stats', 'bio'] as const).map((k) => (
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
