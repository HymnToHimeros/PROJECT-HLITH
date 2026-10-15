import { useState, type CSSProperties } from 'react';
import type { Banner, BannerType, Character, GameContract, Weapon } from '../../core/contract';
import { formatNumber } from '../../core/time/format';
import { setPityManual } from '../../core/data/userData';
import { formatDate, formatRange } from '../../core/time/reset';
import { Button, EmptyState, ExampleTag, NoData, Timer, UnverifiedTag } from '../../core/ui';
import { useAddOwnBanner } from '../banners/AddOwnBanner';
import { PhaseBoard } from '../banners/PhaseBoard';
import { BannerArt } from '../banners/BannerArt';
import { phaseOfBanner } from '../banners/fit';
import { useBannersData, type BannersData } from '../banners/useBannersData';
import { cx } from '../../core/ui/cx';
import { budget, budgetPulls, pullsFor, type BudgetRow } from '../budget/budget';
import { bannerProgress, chance, featuredOf, hardPityOf, pityFromHistory, worstCase, type OddsMode } from '../pity/pity';
import { Filters, percent, Strip } from './shared';
import p from './pulls.module.css';
import type { PullsData } from './usePullsData';

interface Props {
  game: GameContract;
  data: PullsData;
  serverId: string | undefined;
  now: number;
  /** All games: the board shows the game's name beside its columns, like Banners. */
  tagged: boolean;
  openTab: (tab: string) => void;
}

type Target = 'all' | 'character' | 'weapon';
/** Pity you typed in to try out. Kept on this screen only, never saved. */
type WhatIf = Record<string, { pulls: number; guaranteed: boolean }>;

/**
 * Planner (design: Pulls → Planner): one card per banner with pulls you have
 * now, by the banner's end, the worst case and a verdict; chance to win when
 * your pity is known. A filter picks character or weapon banners (V1 feature),
 * and "Know your pity?" lets you try odds before importing, or save your pity
 * (for players who can't import). Each card says which pity it uses.
 */
export function Planner({ game, data, serverId, now, tagged, openTab }: Props) {
  const [target, setTarget] = useState<Target>('all');
  const [whatIf, setWhatIf] = useState<WhatIf>({});
  // Permanent banners have no end to plan pulls by.
  const all = data.banners.list.filter((b) => !b.permanent && Date.parse(b.end) > now);
  const typeOf = (b: Banner) => game.bannerTypes.find((t) => t.id === b.type);
  const banners = all.filter((b) => target === 'all' || typeOf(b)?.target === target).sort((a, b) => Date.parse(a.start) - Date.parse(b.start) || Date.parse(a.end) - Date.parse(b.end));
  const hasWeapon = all.some((b) => typeOf(b)?.target === 'weapon');
  const pityTypes = game.bannerTypes.filter((t) => hardPityOf(t.pity) !== null && all.some((b) => b.type === t.id));
  // Example pulls stand in only where you haven't saved your own pity.
  const examplePity = data.history.example && pityTypes.some((t) => !data.user.pityManual?.[t.id]);
  const { openSheet, sheet } = useAddOwnBanner(game, data.banners.examples);
  // Characters, weapons and art for each card's picture (the same as the Banners module).
  const art = useBannersData(game, now);
  const phaseOf = phaseOfBanner(all, now);

  return (
    <div className={p.stack}>
      {examplePity && (
        <Strip action={{ label: 'Import in History', onClick: () => openTab('history') }}>
          Chance to win needs your pity and 50/50 state. Pull history: no data yet, so the chances below use example pulls (unless you saved your own pity).
        </Strip>
      )}
      <div className={p.toolbar}>
        {hasWeapon && (
          <Filters
            label="Which banners"
            value={target}
            onChange={setTarget}
            options={[
              { id: 'all', label: 'Both' },
              { id: 'character', label: `${game.terms.character} banners` },
              { id: 'weapon', label: `${game.terms.weapon} banners` },
            ]}
          />
        )}
        {pityTypes.length > 0 && <TryPity game={game} types={pityTypes} value={whatIf} onChange={setWhatIf} data={data} />}
      </div>
      {banners.length === 0 ? (
        <EmptyState
          title="No banners yet"
          body="No upcoming banners are listed for this game yet. They appear here as soon as the list has them, or add one yourself to plan for it now."
          action={{ label: 'Add my own banner', onClick: openSheet }}
        />
      ) : (
        <PhaseBoard
          game={game}
          now={now}
          many={tagged}
          column={(id) => {
            const list = banners.filter((b) => phaseOf(b) === id);
            return {
              first: list[0],
              count: list.length,
              children: list.map((b) => {
                const type = typeOf(b);
                return type ? <PlanCard key={b.id} game={game} banner={b} type={type} data={data} art={art} serverId={serverId} now={now} whatIf={whatIf[type.id]} openTab={openTab} /> : null;
              }),
            };
          }}
        />
      )}
      {sheet}
    </div>
  );
}

interface CardProps {
  game: GameContract;
  banner: Banner;
  art: BannersData;
  type: BannerType;
  data: PullsData;
  serverId: string | undefined;
  now: number;
  whatIf: WhatIf[string] | undefined;
  openTab: (tab: string) => void;
}

export type PitySource = 'what-if' | 'history' | 'saved' | 'example';
const SOURCE_LABEL: Record<PitySource, string> = {
  'what-if': 'Your pity (what-if, not saved)',
  history: 'Pity from your history',
  saved: 'Pity you saved',
  example: 'Pity from example pulls',
};

/**
 * Which pity the card uses, and where it comes from: what you're trying out
 * first, then your imported history when it knows both pity and 50/50 state,
 * then the pity you saved yourself, then example pulls. null = unknown.
 */
export function pityFor(
  data: Pick<PullsData, 'history' | 'user'>,
  typeId: string,
  whatIf: WhatIf[string] | undefined,
  guaranteeAfterLoss = true,
): { state: { pulls: number; guaranteed: boolean }; source: PitySource } | null {
  if (whatIf) return { state: whatIf, source: 'what-if' };
  const { pity, guaranteed } = pityFromHistory(data.history.list, typeId, guaranteeAfterLoss);
  const fromHistory = pity.known && guaranteed.known ? { pulls: pity.value, guaranteed: guaranteed.value } : null;
  if (fromHistory && !data.history.example) return { state: fromHistory, source: 'history' };
  const saved = data.user.pityManual?.[typeId];
  if (saved) return { state: { pulls: saved.pity, guaranteed: saved.guaranteed }, source: 'saved' };
  return fromHistory ? { state: fromHistory, source: 'example' } : null;
}

function PlanCard({ game, banner: b, type, data, art, serverId, now, whatIf, openTab }: CardProps) {
  const start = Date.parse(b.start);
  const end = Date.parse(b.end);
  const upcoming = start > now;
  // V1: for a banner that hasn't started, count until it arrives or until it ends.
  const [until, setUntil] = useState<'start' | 'end'>('end');
  const horizon = upcoming && until === 'start' ? start : end;
  const haveNow = data.bank.value.known ? pullsFor(game, data.bank.value.value, type.id) : null;
  const byEnd = budget({
    game,
    serverId,
    now,
    until: horizon,
    bank: data.bank.value,
    paidExtras: data.user.paidExtras,
    paidOff: data.user.paidOff,
    passes: Object.fromEntries(Object.entries(data.user.passes).map(([k, v]) => [k, Date.parse(v)])),
    ...data.budgetExtras(horizon),
  });
  const pullsBy = budgetPulls(game, byEnd, type.id);
  const pick = pityFor(data, type.id, whatIf, featuredOf(type.pity)?.guaranteeAfterLoss ?? true);
  // A game's own rule also reads how far this banner has come (pulls on it so far, from history; none before it opens).
  const progress = type.pity.kind === 'custom' ? (upcoming || data.history.example ? { banner: 0, got: 0 } : bannerProgress(data.history.list, type.id, start)) : undefined;
  const state = { ...(pick?.state ?? { pulls: 0, guaranteed: false }), ...(progress ? { extra: progress } : {}) };
  const stateKnown = pick !== null;
  const worst = worstCase(type.pity, state);
  const odds = (mode: OddsMode) => (stateKnown && pullsBy.known ? chance(type.pity, state, pullsBy.value, mode) : null);
  const official = odds('official');
  const community = odds('community');
  const exampleNumbers = data.bank.example || pick?.source === 'example';
  const worstN = worst.known ? worst.value : null;
  const byN = pullsBy.known ? pullsBy.value : null;
  const short = worstN !== null && byN !== null ? worstN - byN : null;
  const hard = hardPityOf(type.pity);

  return (
    <article className={cx(p.planCard, b.leak && p.leakCard)} style={{ '--vent': game.vent } as CSSProperties} aria-label={b.title}>
      <PlanArt game={game} banner={b} type={type} art={art} />
      <div className={p.kindRow}>
        <span className={p.kind}>{type.label}</span>
        {(data.banners.exampleIds.has(b.id) || exampleNumbers) && <ExampleTag />}
        {b.leak && <UnverifiedTag source={b.leak.source} />}
      </div>
      <div className={p.titleBlock}>
        <h3 className={p.bigTitle}>{b.title}</h3>
        <span className={p.range}>
          {formatRange(start, end)} · {upcoming ? <Timer to={start} prefix="opens in" /> : <Timer to={end} deadline prefix="ends in" />}
        </span>
      </div>
      {upcoming && (
        <Filters
          label={`Count until, for ${b.title}`}
          value={until}
          onChange={setUntil}
          options={[
            { id: 'start', label: 'Until it opens' },
            { id: 'end', label: 'Until it ends' },
          ]}
        />
      )}
      <div className={p.figures}>
        <Figure label="Have now" value={haveNow} />
        <Figure label={upcoming && until === 'start' ? 'When it opens' : 'By end'} value={byN} />
        <Figure label="Worst case" value={worstN} dim />
      </div>
      {worstN !== null && worstN > 0 && (
        <div className={p.bar} role="img" aria-label={`${haveNow ?? 'unknown'} now and ${byN ?? 'unknown'} by then, of ${worstN} for the worst case`}>
          {byN !== null && <span className={p.barBy} style={{ width: `${Math.min(100, (byN / worstN) * 100)}%` }} />}
          {haveNow !== null && <span className={p.barHave} style={{ width: `${Math.min(100, (haveNow / worstN) * 100)}%` }} />}
        </div>
      )}
      <div className={p.verdictRow}>
        {short === null ? (
          // The fix only helps when the missing part is your bank.
          byN === null && !data.bank.value.known ? <NoData dash={false} fix="enter-manually" onFix={() => openTab('log')} /> : <NoData dash={false} />
        ) : short <= 0 ? (
          <span className={p.ok}>Covers the worst case</span>
        ) : (
          <span className={p.short}>{formatNumber(short)} short of worst case</span>
        )}
        <span className={p.muted}>By end counts everything still to earn (see Calculator)</span>
      </div>
      <dl className={p.odds}>
        <div className={p.oddsRow}>
          <dt>Chance by then · official rates</dt>
          <dd className={p.oddsValue}>
            {official?.known ? (
              percent(official.value)
            ) : !stateKnown ? (
              <NoData dash={false} fix="import-history" onFix={() => openTab('history')} />
            ) : !pullsBy.known && !data.bank.value.known ? (
              <NoData dash={false} fix="enter-manually" onFix={() => openTab('log')} />
            ) : (
              <NoData dash={false} />
            )}
          </dd>
        </div>
        <div className={p.oddsRow}>
          <dt>Chance by then · community rates</dt>
          <dd className={p.oddsValue}>{community?.known ? percent(community.value) : <span className={p.muted}>not available</span>}</dd>
        </div>
        {pick && (
          <div className={p.oddsRow}>
            <dt>{SOURCE_LABEL[pick.source]}</dt>
            <dd className={p.oddsValue}>
              {state.pulls}
              {hard !== null ? `/${hard}` : ''} · {state.guaranteed ? 'guaranteed' : '50/50'}
            </dd>
          </div>
        )}
      </dl>
      <LeftOut rows={byEnd.rows} />
    </article>
  );
}

/** Rows the budget couldn't count, grouped by why (e.g. "choose your server"). */
function LeftOut({ rows }: { rows: BudgetRow[] }) {
  const byReason = new Map<string, string[]>();
  for (const r of rows) if (r.status === 'no-data') byReason.set(r.reason ?? 'no data', [...(byReason.get(r.reason ?? 'no data') ?? []), r.label]);
  if (byReason.size === 0) return null;
  const count = [...byReason.values()].flat().length;
  return (
    <details className={p.leftOut}>
      <summary>
        Not counted: {count} {count === 1 ? 'row' : 'rows'} with no data yet
      </summary>
      {[...byReason].map(([reason, labels]) => (
        <span key={reason} className={p.muted}>
          {reason}: {labels.join(', ')}
        </span>
      ))}
    </details>
  );
}

/**
 * What the banner is, like the Banners module shows it: the featured character's art (a weapon
 * banner: the weapon's picture), its name, and the other rate-ups as small portraits. No art →
 * "No art yet", never a made-up picture; sample art only on example banners.
 */
function PlanArt({ game, banner, type, art }: { game: GameContract; banner: Banner; type: BannerType; art: BannersData }) {
  const isWeapon = type.target === 'weapon';
  const weapons = isWeapon ? banner.featured.map((id) => art.weapons.get(id)).filter((w): w is Weapon => Boolean(w)) : [];
  const chars = isWeapon ? [] : banner.featured.map((id) => art.characters.get(id)).filter((c): c is Character => Boolean(c));
  const lead = chars[0];
  const leadWeapon = weapons[0];
  const isExample = art.banners.exampleIds.has(banner.id);
  const src = banner.art ?? (isWeapon ? leadWeapon?.icon : lead ? (isExample ? (art.sampleArt.get(lead.id) ?? lead.art) : lead.art) : undefined);
  const name = isWeapon ? leadWeapon?.name : lead?.name;
  const rarity = isWeapon ? leadWeapon?.rarity : lead?.rarity;
  const madeFor = isWeapon && leadWeapon?.madeFor ? art.characters.get(leadWeapon.madeFor) : undefined;
  const others = isWeapon ? weapons.slice(1) : chars.slice(1);
  const element = lead ? game.elements.find((e) => e.id === lead.element) : undefined;
  return (
    <div className={cx(p.planArt, !src && p.planArtEmpty)} style={{ '--el': element?.color ?? 'var(--line-strong)' } as CSSProperties}>
      {src ? <BannerArt src={src} weapon={isWeapon} className={p.planArtImg ?? ''} /> : <span className={p.planArtInitials} aria-hidden="true">{(name ?? banner.title).slice(0, 2)}</span>}
      {(!src || isExample) && <span className={p.planArtLabel}>{src ? 'SAMPLE ART' : 'NO ART YET'}</span>}
      <div className={p.planArtText}>
        {name ? (
          <span className={p.planArtName}>
            {name} {rarity && rarity !== 'low' && <span className={rarity === 'top' ? p.planTop : p.planMid}>{game.terms.rarity[rarity]}</span>}
          </span>
        ) : (
          <span className={p.planArtName}>{isWeapon ? `${game.terms.weapon} not in HLITH yet` : 'Featured character not in the list yet'}</span>
        )}
        {madeFor && <span className={p.planArtSub}>Made for {madeFor.name}</span>}
      </div>
      {others.length > 0 && (
        <ul className={p.planRateUps} aria-label="Also on rate-up">
          {others.slice(0, 4).map((o) => {
            const pic = isWeapon ? (o as Weapon).icon : (o as Character).portrait;
            return (
              <li key={o.id} title={o.name}>
                {pic ? <img src={pic} alt={o.name} loading="lazy" /> : <span aria-label={o.name}>{o.name.charAt(0)}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Figure({ label, value, dim = false }: { label: string; value: number | null; dim?: boolean }) {
  return (
    <div className={p.figure}>
      <span className={p.figLabel}>{label}</span>
      {value === null ? (
        <NoData />
      ) : (
        <span className={cx(p.figValue, dim && p.dim)}>{formatNumber(value)}</span>
      )}
    </div>
  );
}

/**
 * V1 feature: type your pity in to see the odds, before (or without) importing.
 * Kept on this screen until you press "Save as my pity" (for players on phone or
 * console, who can't import easily). Imported history still wins when it knows.
 */
function TryPity({ game, types, value, onChange, data }: { game: GameContract; types: BannerType[]; value: WhatIf; onChange: (v: WhatIf) => void; data: PullsData }) {
  const [typeId, setTypeId] = useState(types[0]?.id ?? '');
  const type = types.find((t) => t.id === typeId) ?? types[0];
  const hard = type ? hardPityOf(type.pity) : null;
  if (!type || hard === null) return null;
  const featured = featuredOf(type.pity);
  const cur = value[type.id];
  const saved = data.user.pityManual?.[type.id];
  const fromHistory = pityFromHistory(data.history.list, type.id, featured?.guaranteeAfterLoss ?? true);
  const historyWins = !data.history.example && fromHistory.pity.known && fromHistory.guaranteed.known;
  // Only ask about a guarantee where losing a 50/50 gives one.
  const hasFeatured = featured?.guaranteeAfterLoss === true;
  const set = (next: { pulls: number; guaranteed: boolean } | null) => {
    const rest = Object.fromEntries(Object.entries(value).filter(([id]) => id !== type.id));
    onChange(next ? { ...rest, [type.id]: next } : rest);
  };
  const save = () => {
    if (!cur) return;
    setPityManual(game.id, type.id, { pity: cur.pulls, guaranteed: cur.guaranteed });
    set(null); // the saved pity shows from now on
  };
  return (
    <details className={p.tryPity}>
      <summary>Know your pity? Try it or save it here</summary>
      <div className={p.tryBody}>
        <label className={p.field}>
          Banner
          <select className={p.input} value={type.id} onChange={(e) => setTypeId(e.target.value)}>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className={p.field}>
          Pulls since your last {game.terms.rarity.top}
          <input
            className={p.input}
            type="number"
            inputMode="numeric"
            min={0}
            max={hard - 1}
            value={cur ? cur.pulls : ''}
            placeholder="e.g. 40"
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10);
              set(Number.isFinite(n) ? { pulls: Math.min(hard - 1, Math.max(0, n)), guaranteed: cur?.guaranteed ?? false } : null);
            }}
          />
        </label>
        {hasFeatured && (
          <label className={p.field}>
            Next {game.terms.rarity.top}
            <select className={p.input} value={cur?.guaranteed ? 'g' : 'f'} onChange={(e) => set({ pulls: cur?.pulls ?? 0, guaranteed: e.target.value === 'g' })}>
              <option value="f">50/50</option>
              <option value="g">Guaranteed (lost the last 50/50)</option>
            </select>
          </label>
        )}
        <Button variant="primary" disabled={!cur} onClick={save}>
          Save as my pity
        </Button>
        {saved && (
          <Button variant="quiet" onClick={() => setPityManual(game.id, type.id, null)}>
            Clear saved pity
          </Button>
        )}
        <span className={p.muted}>
          {saved
            ? `Saved for ${type.label}: ${saved.pity}/${hard}${hasFeatured ? ` · ${saved.guaranteed ? 'guaranteed' : '50/50'}` : ''}, on ${formatDate(Date.parse(saved.at))}. Update it after you pull.`
            : 'Typing only tries it out on this screen. Save it to keep it, for example if you play on phone or console and can’t import.'}
          {historyWins ? ' Your imported history knows this banner’s pity, so the cards use that instead.' : ''}
        </span>
      </div>
    </details>
  );
}
