import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import type { BacklogItem, Character, GameContract, GameId, ModuleId } from '../../core/contract';
import { usePrefs } from '../../core/data/prefs';
import { gameData, useAllUserData } from '../../core/data/userData';
import type { PanelAccount } from '../../core/registry/panels';
import { formatDate } from '../../core/time/reset';
import { Button, CharacterTile, GameTag, HowTo, initials } from '../../core/ui';
import { formatNumber } from '../../core/time/format';
import p from './profile.module.css';
import {
  BIO_MAX,
  CARD_IDS,
  CARD_LABEL,
  checkImage,
  cleanProfile,
  NAME_MAX,
  PIN_MAX,
  setCardShown,
  togglePin,
  type CardId,
  type Profile,
} from './profile';
import { METHOD_LABEL, showcaseCards, type Fix, type ShowcaseCard } from './showcase';
import { storeFor, useProfile } from './useProfile';
import { BadgeList } from './BadgeList';
import { CardEditor } from './CardEditor';
import { badgeStates, type BadgeState } from './badges';
import { buildCard } from './cardData';
import { ProfileCard } from './ProfileCard';
import { useCheckinDays } from './useCheckinDays';
import { ImageAdjust } from './ImageAdjust';
import type { ImageKind } from './imageCrop';

interface Props {
  games: GameContract[];
  account: PanelAccount | null;
  /** From the server only (public.is_owner()): the owner badge and the sky frame. */
  isOwner?: boolean;
  open: (module: ModuleId, tab?: string) => void;
  goSection: (section: string) => void;
}

/** Built-in character and backlog lists for the games shown (missing while loading). */
export function useLists(games: GameContract[]) {
  const [lists, setLists] = useState<{ characters: Record<GameId, Character[]>; backlog: Record<GameId, BacklogItem[]> }>({ characters: {}, backlog: {} });
  useEffect(() => {
    let alive = true;
    for (const g of games) {
      g.data
        .characters()
        .catch(() => [] as Character[])
        .then((list) => alive && setLists((cur) => ({ ...cur, characters: { ...cur.characters, [g.id]: list.map((c) => (c.name.includes('<') ? { ...c, name: c.name.replace(/<\/?[a-z]+[^>]*>/gi, '') } : c)) } })));
      g.data
        .backlog()
        .catch(() => [] as BacklogItem[])
        .then((list) => alive && setLists((cur) => ({ ...cur, backlog: { ...cur.backlog, [g.id]: list } })));
    }
    return () => {
      alive = false;
    };
  }, [games]);
  return lists;
}

/** A soft wash in your games' vent colours, used when you haven't picked a banner. */
export function defaultBanner(games: GameContract[]): string {
  const vents = games.length ? games.map((g) => g.vent) : ['#CFE3EF'];
  const a = vents[0];
  const b = vents[1] ?? vents[0];
  return [
    `radial-gradient(90% 140% at 0% 0%, color-mix(in srgb, ${a} 42%, transparent), transparent 62%)`,
    `radial-gradient(80% 140% at 100% 100%, color-mix(in srgb, ${b} 34%, transparent), transparent 60%)`,
    'repeating-linear-gradient(135deg, transparent 0 14px, rgb(255 255 255 / 0.025) 14px 15px)',
    'linear-gradient(160deg, var(--bg-shell), var(--bg-card))',
  ].join(', ');
}

/**
 * Account → Profile: a showcase you customise. Banner, picture, name, bio, pinned
 * characters and which cards show. Every number comes from your own data; a card
 * with nothing behind it says "No data yet" and links to where to add it.
 */
/** Every badge for this profile, from your own data (badges.ts). */
function useBadges(games: GameContract[], profile: Profile, isOwner: boolean, userId: string | undefined): BadgeState[] {
  const all = useAllUserData();
  const checkinDays = useCheckinDays(userId);
  return useMemo(
    () =>
      badgeStates({
        games,
        data: Object.fromEntries(games.map((g) => [g.id, all.games[g.id] ? gameData(g.id) : undefined])),
        isOwner,
        checkinDays,
        profile: { hasPicture: Boolean(profile.avatar || profile.avatarChar), hasTitle: Boolean(profile.title) },
      }),
    [all, games, isOwner, checkinDays, profile.avatar, profile.avatarChar, profile.title],
  );
}

export function ProfileSection({ games, account, isOwner = false, open, goSection }: Props) {
  const store = useMemo(() => storeFor(account?.id), [account?.id]);
  const state = useProfile(store);
  const [editing, setEditing] = useState(false);
  const prefs = usePrefs();
  const all = useAllUserData();
  const lists = useLists(games);
  const { profile } = state;
  const badges = useBadges(games, profile, isOwner, account?.id);

  const cards = useMemo(() => {
    void all; // re-read when your data changes
    return showcaseCards({
      games,
      servers: prefs.servers,
      data: Object.fromEntries(games.map((g) => [g.id, gameData(g.id)])),
      characters: lists.characters,
      backlog: lists.backlog,
      account: account ? { identities: account.identities ?? [], provider: account.provider, createdAt: account.createdAt } : null,
      pinned: profile.pinned,
    });
  }, [all, games, prefs.servers, lists, account, profile.pinned]);

  const doFix = (fix: Fix) => ('module' in fix ? open(fix.module, fix.tab) : goSection(fix.section));
  const name = profile.displayName ?? (account ? (account.email.split('@')[0] ?? null) : null);
  const where = state.mode === 'account' ? 'Saved to your account' : 'Saved on this device only';

  if (state.loading) return <p className={p.muted}>Loading your profile…</p>;

  if (editing)
    return (
      <ProfileEditor
        games={games}
        profile={profile}
        imageUrl={state.imageUrl}
        mode={state.mode}
        fallbackName={name}
        badges={badges}
        isOwner={isOwner}
        error={state.error}
        onCancel={() => setEditing(false)}
        onSave={async (next) => {
          if (await state.save(next)) setEditing(false);
        }}
        open={open}
      />
    );

  const shown = CARD_IDS.filter((id) => !profile.hiddenCards.includes(id));
  const card = buildCard({
    profile,
    games,
    data: Object.fromEntries(games.map((g) => [g.id, gameData(g.id)])),
    characters: lists.characters,
    badges,
    imageUrl: state.imageUrl,
    fallbackName: name ?? 'Your profile',
    bannerFallback: defaultBanner(games),
  });

  return (
    <div className={p.stack}>
      <section className={p.hero} aria-label="Your profile">
        <ProfileCard
          {...card}
          note={
            <>
              {account ? `Signed in with ${METHOD_LABEL[account.provider ?? ''] ?? account.provider ?? 'your account'}` : 'This device only'} · {where}
              {profile.privacy.card && state.mode === 'account' ? ' · Shown with teams you share' : ''}
            </>
          }
          actions={
            <Button variant="primary" onClick={() => setEditing(true)}>
              Customise profile
            </Button>
          }
        />
        {profile.bio ? <p className={p.bio}>{profile.bio}</p> : <p className={p.bioEmpty}>No bio yet. Customise profile to add a few words about you.</p>}
      </section>

      {state.error && (
        <p className={p.warn} role="alert">
          {state.error}
        </p>
      )}
      {state.deviceCopy && (
        <div className={p.notice}>
          <p className={p.text}>This device has a profile saved from before you signed in. Your account’s profile is still empty.</p>
          <div className={p.actions}>
            <Button onClick={() => void state.save(cleanProfile(state.deviceCopy))}>Use the profile from this device</Button>
            <Button variant="quiet" onClick={state.dismissDeviceCopy}>
              Keep my account’s profile
            </Button>
          </div>
          <p className={p.muted}>Either way, the copy on this device isn’t deleted.</p>
        </div>
      )}

      <div className={p.showcase} aria-label="Showcase">
        {shown.map((id) => (
          <ShowcaseTile key={id} card={cards[id]} onFix={doFix} />
        ))}
        {shown.length === 0 && <p className={p.muted}>Every showcase card is switched off. Customise profile to show some again.</p>}
      </div>

      <BadgeList badges={badges} ownerTitle={profile.ownerTitle} onGo={(go) => ('section' in go ? (go.section === 'profile' ? setEditing(true) : goSection(go.section)) : open(go.module, go.tab))} />

      <HowTo
        steps={[
          'Press “Customise profile” to add a picture (your own or one of your characters), a banner, a frame, your name’s colour, a title and a short bio. After choosing a picture you can drag and zoom it to choose exactly what shows.',
          'Pick up to 4 favourite characters or teams for your card, and the badge it shows. Badges come only from your own data: “Not yet” says how to earn one.',
          'Pin up to 6 favourite characters per game. Only characters you marked as owned in Roster can be pinned.',
          'Switch showcase cards on or off. A card shows only what HLITH can prove from your own data: imported pulls, your roster, your backlog counts.',
          state.mode === 'account'
            ? 'Your profile is saved to your account, and the pictures to your own folder. Pictures are public links so they can show; your name, bio and stats stay private to you.'
            : 'Your profile stays on this device. Pictures are cropped to what you chose and shrunk so they fit in this browser, and they’re included when you export a backup.',
        ]}
      >
        “No data yet” means there is nothing to show from your own data. The button next to it takes you to where you add it.
      </HowTo>
    </div>
  );
}

function Avatar({ src, letter, size = 'lg' }: { src: string | null; letter: string; size?: 'lg' | 'md' }) {
  return (
    <span className={size === 'lg' ? p.avatar : `${p.avatar} ${p.avatarMd}`} aria-hidden="true">
      {src ? <img src={src} alt="" /> : letter.charAt(0).toUpperCase() || '?'}
    </span>
  );
}

function Missing({ fix, onFix, why }: { fix?: Fix | undefined; onFix: (f: Fix) => void; why?: string }) {
  return (
    <div className={p.missing}>
      <span className={p.dash} aria-hidden="true">
        —
      </span>
      <span className={p.noData}>No data yet</span>
      {why && <span className={p.muted}>{why}</span>}
      {fix && (
        <Button variant="quiet" onClick={() => onFix(fix)}>
          {fix.label}
        </Button>
      )}
    </div>
  );
}

const vent = (g: GameContract) => ({ '--game-vent': g.vent }) as CSSProperties;

function Tile({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <section className={wide ? `${p.tile} ${p.tileWide}` : p.tile} aria-label={label}>
      <h3 className={p.tileLabel}>{label}</h3>
      {children}
    </section>
  );
}

export function ShowcaseTile({ card, onFix }: { card: ShowcaseCard; onFix: (f: Fix) => void }) {
  const label = CARD_LABEL[card.id];
  switch (card.id) {
    case 'games':
      return (
        <Tile label={label}>
          {card.lines.map(({ game, server }) => (
            <div key={game.id} className={p.line} style={vent(game)}>
              <GameTag label={game.short} vent={game.vent} />
              <span className={p.lineMain}>{game.name}</span>
              <span className={server ? p.lineValue : p.noData}>{server ?? 'No server yet'}</span>
            </div>
          ))}
          {card.fix && (
            <Button variant="quiet" onClick={() => onFix(card.fix as Fix)}>
              {card.fix.label}
            </Button>
          )}
        </Tile>
      );
    case 'sign-in':
      return (
        <Tile label={label}>
          {card.empty ? (
            <Missing fix={card.fix} onFix={onFix} why="This site runs in “this device only” mode." />
          ) : (
            <div className={p.chips}>
              {card.methods.map((m) => (
                <span key={m} className={p.chip}>
                  {METHOD_LABEL[m] ?? m}
                </span>
              ))}
            </div>
          )}
        </Tile>
      );
    case 'member-since':
      return (
        <Tile label={label}>
          {card.since ? <span className={p.big}>{formatDate(Date.parse(card.since))}</span> : <Missing fix={card.fix} onFix={onFix} why="Needs an account." />}
        </Tile>
      );
    case 'characters':
      return (
        <Tile label={label} wide>
          {card.empty ? (
            <Missing fix={card.fix} onFix={onFix} why="Mark the characters you own in Roster." />
          ) : (
            card.lines.map((l) => (
              <div key={l.game.id} className={p.group}>
                <div className={p.line}>
                  <GameTag label={l.game.short} vent={l.game.vent} />
                  <span className={p.big}>{formatNumber(l.owned)}</span>
                  <span className={p.muted}>owned</span>
                </div>
                {l.pinned.length > 0 ? (
                  <div className={p.pins}>
                    {l.pinned.map((c) => (
                      <PinTile key={c.id} game={l.game} c={c} />
                    ))}
                  </div>
                ) : (
                  <span className={p.muted}>No favourites pinned. Customise profile to pin up to {PIN_MAX}.</span>
                )}
              </div>
            ))
          )}
        </Tile>
      );
    case 'pulls':
      return (
        <Tile label={label}>
          {card.empty ? (
            <Missing fix={card.fix} onFix={onFix} why="Import your pull history." />
          ) : (
            card.lines.map((l) => (
              <div key={l.game.id} className={p.line}>
                <GameTag label={l.game.short} vent={l.game.vent} />
                <span className={p.big}>{formatNumber(l.total)}</span>
                <span className={p.muted}>
                  pulls · {formatNumber(l.tops)} {l.game.terms.rarity.top}
                </span>
              </div>
            ))
          )}
        </Tile>
      );
    case 'pity':
      return (
        <Tile label={label}>
          {card.empty ? (
            <Missing fix={card.fix} onFix={onFix} why="Pity is worked out from imported history." />
          ) : (
            card.lines.map((l) => (
              <div key={l.game.id} className={p.group}>
                {l.banners.map((b) => (
                  <div key={b.id} className={p.line}>
                    <GameTag label={l.game.short} vent={l.game.vent} />
                    <span className={p.lineMain}>{b.label}</span>
                    <span className={p.lineValue}>{b.pity}</span>
                    {b.guaranteed.known && b.guaranteed.value && <span className={p.chip}>guaranteed</span>}
                  </div>
                ))}
              </div>
            ))
          )}
          {!card.empty && <span className={p.muted}>Pulls since your last top result, from your imported history.</span>}
        </Tile>
      );
    case 'backlog':
      return (
        <Tile label={label}>
          {card.empty ? (
            <Missing fix={card.fix} onFix={onFix} why="Enter how much you’ve done in Backlog." />
          ) : (
            card.lines.map((l) => (
              <div key={l.game.id} className={p.group}>
                <div className={p.line}>
                  <GameTag label={l.game.short} vent={l.game.vent} />
                  {l.done !== null ? <span className={p.big}>{Math.round(l.done * 100)}%</span> : <span className={p.lineValue}>{`${l.counted} of ${l.items} counted`}</span>}
                </div>
                {l.done !== null ? (
                  <div className={p.track} role="progressbar" aria-label={`${l.game.short} backlog done`} aria-valuenow={Math.round(l.done * 100)} aria-valuemin={0} aria-valuemax={100}>
                    <div className={p.fill} style={{ width: `${l.done * 100}%`, background: l.game.vent }} />
                  </div>
                ) : (
                  <span className={p.muted}>The percentage shows once every item has a count.</span>
                )}
              </div>
            ))
          )}
        </Tile>
      );
  }
}

function PinTile({ game, c }: { game: GameContract; c: Character }) {
  const el = game.elements.find((e) => e.id === c.element);
  const role = game.roles.find((r) => r.id === c.role);
  const entry = gameData(game.id).roster[c.id];
  return (
    <CharacterTile
      name={c.name}
      subtitle={[role?.label, el?.label].filter(Boolean).join(' · ')}
      rarity={c.rarity}
      rarityLabel={game.terms.rarity[c.rarity]}
      elementColor={el?.color ?? 'var(--line-empty)'}
      owned
      dupes={game.dupes && entry ? `${game.dupes.prefix}${entry.dupes}` : undefined}
      art={c.portrait}
    />
  );
}

// ── Edit ─────────────────────────────────────────────────────────────

interface EditorProps {
  games: GameContract[];
  profile: Profile;
  imageUrl: (v: string | null) => string | null;
  mode: 'device' | 'account';
  fallbackName: string | null;
  badges: BadgeState[];
  isOwner: boolean;
  error: string;
  onCancel: () => void;
  onSave: (p: Profile) => Promise<void>;
  open: (module: ModuleId, tab?: string) => void;
}

function ProfileEditor({ games, profile, imageUrl, mode, fallbackName, badges, isOwner, error, onCancel, onSave, open }: EditorProps) {
  const [draft, setDraft] = useState<Profile>(profile);
  const [busy, setBusy] = useState(false);
  const [imageError, setImageError] = useState('');
  const lists = useLists(games);

  // While editing, the file you picked stays in memory (never stored) so "Adjust" starts from the full picture.
  const [originals, setOriginals] = useState<Partial<Record<ImageKind, Blob>>>({});
  const [adjust, setAdjust] = useState<{ kind: ImageKind; source: Blob } | null>(null);

  const pick = (file: File | undefined, kind: ImageKind) => {
    setImageError('');
    if (!file) return;
    const problem = checkImage(file);
    if (problem) return setImageError(problem);
    setOriginals((o) => ({ ...o, [kind]: file }));
    setAdjust({ kind, source: file });
  };
  const startAdjust = async (kind: ImageKind) => {
    setImageError('');
    const original = originals[kind];
    if (original) return setAdjust({ kind, source: original });
    const url = show(draft[kind]);
    if (!url) return;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      setAdjust({ kind, source: await res.blob() });
    } catch {
      setImageError('The saved picture couldn’t be opened for adjusting. Choose the file again instead.');
    }
  };
  const remove = (kind: ImageKind) => {
    setDraft((d) => ({ ...d, [kind]: null }));
    setOriginals((o) => ({ ...o, [kind]: undefined }));
  };
  const show = (v: string | null) => (v?.startsWith('data:') ? v : imageUrl(v));
  const banner = show(draft.banner);
  const avatar = show(draft.avatar);
  // The live preview: exactly the card others see, from the draft.
  const preview = buildCard({
    profile: draft,
    games,
    data: Object.fromEntries(games.map((g) => [g.id, gameData(g.id)])),
    characters: lists.characters,
    badges: badges.map((b) => (b.def.id === 'self-portrait' ? { ...b, earned: Boolean((draft.avatar || draft.avatarChar) && draft.title) } : b)),
    imageUrl: show,
    fallbackName: draft.displayName ?? fallbackName ?? 'Your profile',
    bannerFallback: defaultBanner(games),
  });

  return (
    <form
      className={p.stack}
      aria-label="Edit profile"
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        void onSave(draft).finally(() => setBusy(false));
      }}
    >
      <section className={p.previewWrap} aria-label="Preview">
        <span className={p.fieldLabel}>Preview · how your card looks</span>
        <ProfileCard {...preview} compact />
      </section>

      <section className={p.editCard} aria-label="Pictures">
        <h3 className={p.cardTitle}>Pictures</h3>
        <div className={p.bannerEdit} style={{ background: defaultBanner(games) }}>
          {banner && <img src={banner} alt="Banner preview" className={p.bannerImg} />}
          <Avatar src={avatar} letter={draft.displayName ?? fallbackName ?? ''} size="md" />
        </div>
        <p className={p.muted}>
          After you choose a file you can move and zoom it, so nothing you want is cut off. The preview shows exactly how it will look. PNG, JPG, WebP or GIF, up to 2 MB.
        </p>
        <div className={p.actions}>
          <FilePick label={draft.avatar ? 'Change picture' : 'Choose picture'} onPick={(f) => pick(f, 'avatar')} />
          {draft.avatar && (
            <>
              <Button onClick={() => void startAdjust('avatar')}>Adjust picture</Button>
              <Button variant="quiet" onClick={() => remove('avatar')}>
                Remove picture
              </Button>
            </>
          )}
        </div>
        <div className={p.actions}>
          <FilePick label={draft.banner ? 'Change banner' : 'Choose banner'} onPick={(f) => pick(f, 'banner')} />
          {draft.banner && (
            <>
              <Button onClick={() => void startAdjust('banner')}>Adjust banner</Button>
              <Button variant="quiet" onClick={() => remove('banner')}>
                Remove banner
              </Button>
            </>
          )}
        </div>
        {imageError && (
          <p className={p.warn} role="alert">
            {imageError}
          </p>
        )}
        {adjust && (
          <ImageAdjust
            key={adjust.kind}
            kind={adjust.kind}
            source={adjust.source}
            background={adjust.kind === 'banner' ? defaultBanner(games) : 'var(--bg-raised)'}
            bannerBackground={defaultBanner(games)}
            other={adjust.kind === 'avatar' ? banner : avatar}
            name={draft.displayName ?? fallbackName ?? ''}
            onCancel={() => setAdjust(null)}
            onSave={(url) => {
              setDraft((d) => ({ ...d, [adjust.kind]: url }));
              setAdjust(null);
            }}
          />
        )}
      </section>

      <section className={p.editCard} aria-label="About you">
        <h3 className={p.cardTitle}>About you</h3>
        <label className={p.field}>
          <span className={p.fieldLabel}>Display name</span>
          <input
            className={p.input}
            value={draft.displayName ?? ''}
            maxLength={NAME_MAX}
            placeholder={fallbackName ?? 'Your name'}
            onChange={(e) => setDraft((d) => ({ ...d, displayName: e.target.value }))}
          />
        </label>
        <label className={p.field}>
          <span className={p.fieldLabel}>
            Bio <span className={p.count}>{(draft.bio ?? '').length} / {BIO_MAX}</span>
          </span>
          <textarea className={p.textarea} value={draft.bio ?? ''} maxLength={BIO_MAX} rows={3} onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value }))} />
        </label>
      </section>

      <CardEditor draft={draft} setDraft={setDraft} games={games} characters={lists.characters} badges={badges} isOwner={isOwner} mode={mode} open={open} />

      <section className={p.editCard} aria-label="Pinned characters">
        <h3 className={p.cardTitle}>Pinned characters</h3>
        <p className={p.muted}>Up to {PIN_MAX} per game, from the characters you marked as owned in Roster.</p>
        {games.map((g) => {
          const roster = gameData(g.id).roster;
          const owned = (lists.characters[g.id] ?? []).filter((c) => roster[c.id]?.owned);
          const pinned = draft.pinned[g.id] ?? [];
          // Pinned earlier but no longer owned (or gone from the list): shown dimmed so they can be unpinned.
          const stale = pinned.filter((id) => !owned.some((c) => c.id === id));
          const nameOf = (id: string) => lists.characters[g.id]?.find((c) => c.id === id)?.name ?? id;
          const staleChips = stale.map((id) => (
            <button key={id} type="button" className={`${p.pinChip} ${p.pinStale}`} style={vent(g)} onClick={() => setDraft((d) => togglePin(d, g.id, id))} aria-label={`Unpin ${nameOf(id)} (not owned)`}>
              <span className={p.pinInitials} aria-hidden="true">
                {initials(nameOf(id))}
              </span>
              {nameOf(id)} · not owned
              <span aria-hidden="true">✕</span>
            </button>
          ));
          return (
            <div key={g.id} className={p.group}>
              <div className={p.line}>
                <GameTag label={g.short} vent={g.vent} />
                <span className={p.count}>
                  {pinned.length} / {PIN_MAX} pinned
                </span>
              </div>
              {lists.characters[g.id] === undefined ? (
                <span className={p.muted}>Loading…</span>
              ) : owned.length === 0 ? (
                <>
                  <div className={p.missing}>
                    <span className={p.noData}>No owned characters yet</span>
                    <Button variant="quiet" onClick={() => open('roster', 'characters')}>
                      Open Roster
                    </Button>
                  </div>
                  {staleChips.length > 0 && (
                    <div className={p.chips} role="group" aria-label={`Pinned ${g.short} characters you no longer own`}>
                      {staleChips}
                    </div>
                  )}
                </>
              ) : (
                <div className={p.chips} role="group" aria-label={`Pin ${g.short} characters`}>
                  {owned.map((c) => {
                    const on = pinned.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        className={p.pinChip}
                        style={vent(g)}
                        aria-pressed={on}
                        disabled={!on && pinned.length >= PIN_MAX}
                        onClick={() => setDraft((d) => togglePin(d, g.id, c.id))}
                      >
                        <span className={p.pinInitials} aria-hidden="true">
                          {initials(c.name)}
                        </span>
                        {c.name}
                      </button>
                    );
                  })}
                  {staleChips}
                </div>
              )}
            </div>
          );
        })}
      </section>

      <section className={p.editCard} aria-label="Showcase cards">
        <h3 className={p.cardTitle}>Showcase cards</h3>
        {CARD_IDS.map((id: CardId) => (
          <label key={id} className={p.switchRow}>
            <span className={p.switchText}>{CARD_LABEL[id]}</span>
            <span className={p.switch}>
              <input type="checkbox" role="switch" checked={!draft.hiddenCards.includes(id)} onChange={(e) => setDraft((d) => setCardShown(d, id, e.target.checked))} aria-label={CARD_LABEL[id]} />
              <span className={p.trackSw} aria-hidden="true" />
            </span>
          </label>
        ))}
      </section>

      {error && (
        <p className={p.warn} role="alert">
          {error}
        </p>
      )}
      <div className={p.actions}>
        <Button variant="primary" type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save profile'}
        </Button>
        <Button onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <span className={p.muted}>{mode === 'account' ? 'Saves to your account.' : 'Saves on this device only.'}</span>
      </div>
    </form>
  );
}

function FilePick({ label, onPick }: { label: string; onPick: (f: File | undefined) => void }) {
  return (
    <label className={p.filePick}>
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className={p.fileInput}
        onChange={(e) => {
          onPick(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {label}
    </label>
  );
}
