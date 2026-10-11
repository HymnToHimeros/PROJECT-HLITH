import type { CSSProperties, ReactNode } from 'react';
import type { GameContract, ModuleId } from '../../core/contract';
import { updatePrefs, usePrefs, type Prefs } from '../../core/data/prefs';
import { MODULES } from '../../core/registry/modules';
import {
  ACCENT_LABEL,
  ACCENT_VALUE,
  ACCENTS,
  CARD_STYLE_LABEL,
  CARD_STYLES,
  CORNERS,
  CORNERS_LABEL,
  FONT_LABEL,
  FONTS,
  lookOf,
  SPACING_LABEL,
  SPACINGS,
  TEXT_SIZE_LABEL,
  TEXT_SIZES,
  type Look,
} from '../../core/theme/look';
import { useOwnerThemes } from '../../core/theme/ownerThemes';
import { cleanSchedule, type ThemeChoice, type ThemeSchedule } from '../../core/theme/schedule';
import { THEMES, themeInfo } from '../../core/theme/theme';
import { VENT_CHOICES } from '../../core/theme/vents';
import { cleanFormat, type DisplayFormat } from '../../core/time/displayFormat';
import { formatNumber } from '../../core/time/format';
import { formatDate, formatDateTime, formatTime } from '../../core/time/reset';
import { Button, GameTag, Segmented, useNow } from '../../core/ui';
import { EVENT_KINDS, hiddenKinds, KIND_LABEL } from '../events/kindPrefs';
import { TILE_PARTS, type TilePart } from '../roster/tileParts';
import a from './account.module.css';
import { Switch } from './parts';

type Section = 'look' | 'colours' | 'schedule' | 'layout' | 'format' | 'roster' | 'lists';

/** What "Reset this section" puts back: the setting is removed, so the default shows again. Nothing else is touched. */
const without = (p: Prefs, keys: (keyof Prefs)[]): Prefs => Object.fromEntries(Object.entries(p).filter(([k]) => !keys.includes(k as keyof Prefs))) as unknown as Prefs;
const RESET: Record<Section, (p: Prefs) => Prefs> = {
  look: (p) => ({ ...p, look: {} }),
  colours: (p) => without(p, ['gameVents']),
  schedule: (p) => without(p, ['themeSchedule']),
  layout: (p) => without(p, ['startModule', 'defaultScope', 'startTabs']),
  format: (p) => without(p, ['format']),
  roster: (p) => without(p, ['roster']),
  lists: (p) => without(p, ['hiddenEventKinds', 'eventKindColours', 'bannerView']),
};
/** A copy without the empty entries. */
const compact = <T extends Record<string, unknown>>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '' && v !== null)) as T;

function Card({ id, title, children, changed }: { id: Section; title: string; children: ReactNode; changed: boolean }) {
  return (
    <section className={a.card} aria-labelledby={`customise-${id}`}>
      <div className={a.cardHead}>
        <h3 className={a.cardTitle} id={`customise-${id}`}>
          {title}
        </h3>
        {changed && (
          <Button variant="quiet" onClick={() => updatePrefs(RESET[id])}>
            Reset this section
          </Button>
        )}
      </div>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={a.lookRow}>
      <span className={a.small}>{label}</span>
      {children}
    </div>
  );
}

const setLook = (change: Partial<Look>) => updatePrefs((p) => ({ ...p, look: { ...lookOf(p), ...change } }));
const setFormat = (change: { [K in keyof DisplayFormat]?: DisplayFormat[K] | undefined }) => updatePrefs((p) => ({ ...p, format: compact({ ...cleanFormat(p.format), ...change }) as DisplayFormat }));

/**
 * Account → Customise (T52b): one place for how HLITH looks and behaves. Every choice is a
 * saved setting (synced with your account once signed in) and changes the app straight away;
 * the preview at the top shows it. "Reset this section" puts that section back to the default
 * and touches nothing else. Lists from the games never change any of it.
 */
export function CustomisePage({ games, editLayout, goSection }: { games: GameContract[]; editLayout: () => void; goSection: (section: string) => void }) {
  const prefs = usePrefs();
  const look = lookOf(prefs);
  const format = cleanFormat(prefs.format);
  const tone = (document.documentElement.dataset.tone === 'light' ? 'light' : 'dark') as 'dark' | 'light';
  const accent = look.accent ?? 'theme';
  const now = useNow(60_000);
  return (
    <>
      <Preview games={games} now={now} />

      <Card id="look" title="Look" changed={Object.keys(look).length > 0}>
        <p className={a.small}>Make any theme yours. Every accent is checked against every theme, so text stays readable.</p>
        <Row label="Accent colour">
          <div className={a.accentRow} role="radiogroup" aria-label="Accent colour">
            {ACCENTS.map((id) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={accent === id}
                className={a.accentChip}
                style={{ '--chip': id === 'theme' ? 'var(--ink-3)' : ACCENT_VALUE[id][tone] } as CSSProperties}
                onClick={() => setLook({ accent: id })}
              >
                <span className={a.accentDot} aria-hidden="true" />
                {ACCENT_LABEL[id]}
              </button>
            ))}
          </div>
        </Row>
        <Row label="Font">
          <Segmented label="Font" value={look.font ?? 'archivo'} onChange={(v) => setLook({ font: v })} options={FONTS.map((id) => ({ id, label: FONT_LABEL[id] }))} />
        </Row>
        <Row label="Text size">
          <Segmented label="Text size" value={look.textSize ?? 'normal'} onChange={(v) => setLook({ textSize: v })} options={TEXT_SIZES.map((id) => ({ id, label: TEXT_SIZE_LABEL[id] }))} />
        </Row>
        <Row label="Spacing">
          <Segmented label="Spacing" value={look.spacing ?? 'normal'} onChange={(v) => setLook({ spacing: v })} options={SPACINGS.map((id) => ({ id, label: SPACING_LABEL[id] }))} />
        </Row>
        <Row label="Card corners">
          <Segmented label="Card corners" value={look.corners ?? 'soft'} onChange={(v) => setLook({ corners: v })} options={CORNERS.map((id) => ({ id, label: CORNERS_LABEL[id] }))} />
        </Row>
        <Row label="Cards">
          <Segmented label="Cards" value={look.cards ?? 'solid'} onChange={(v) => setLook({ cards: v })} options={CARD_STYLES.map((id) => ({ id, label: CARD_STYLE_LABEL[id] }))} />
        </Row>
        <p className={a.small}>Glass lets the theme’s background art show through the cards. Animations live in Account → Theme.</p>
      </Card>

      <GameColours games={games} prefs={prefs} />
      <Schedule games={games} prefs={prefs} />
      <LayoutCard games={games} prefs={prefs} editLayout={editLayout} />

      <Card id="format" title="Time and format" changed={Object.keys(format).length > 0}>
        <Row label="Clock">
          <Segmented
            label="Clock"
            value={format.clock ?? 'device'}
            onChange={(v) => setFormat({ clock: v === 'device' ? undefined : v })}
            options={[
              { id: 'device', label: 'My device’s' },
              { id: '24h', label: '24-hour' },
              { id: '12h', label: '12-hour' },
            ]}
          />
        </Row>
        <Row label="Dates">
          <Segmented
            label="Dates"
            value={format.date ?? 'device'}
            onChange={(v) => setFormat({ date: v === 'device' ? undefined : v })}
            options={[
              { id: 'device', label: 'My device’s' },
              { id: 'dmy', label: '11 Oct' },
              { id: 'mdy', label: 'Oct 11' },
              { id: 'ymd', label: '10-11' },
            ]}
          />
        </Row>
        <Row label="Numbers">
          <Segmented
            label="Numbers"
            value={format.numbers ?? 'device'}
            onChange={(v) => setFormat({ numbers: v === 'device' ? undefined : v })}
            options={[
              { id: 'device', label: 'My device’s' },
              { id: 'comma', label: '12,480' },
              { id: 'dot', label: '12.480' },
              { id: 'space', label: '12 480' },
            ]}
          />
        </Row>
        <Row label="Weeks start on">
          <Segmented
            label="Weeks start on"
            value={format.weekStart ?? 'mon'}
            onChange={(v) => setFormat({ weekStart: v === 'mon' ? undefined : v })}
            options={[
              { id: 'mon', label: 'Monday' },
              { id: 'sun', label: 'Sunday' },
            ]}
          />
        </Row>
        <Row label="Countdowns">
          <Segmented
            label="Countdowns"
            value={format.countdown ?? 'left'}
            onChange={(v) => setFormat({ countdown: v === 'left' ? undefined : v })}
            options={[
              { id: 'left', label: 'Time left' },
              { id: 'date', label: 'The date' },
              { id: 'both', label: 'Both' },
            ]}
          />
        </Row>
        <p className={a.small}>
          Now: {formatDateTime(now)} · {formatNumber(12480)} · Game resets stay on each server’s own clock; only how times are written changes.
        </p>
      </Card>

      <RosterCard prefs={prefs} />
      <ListsCard prefs={prefs} tone={tone} />

      <section className={a.card} aria-label="More to make yours">
        <h3 className={a.cardTitle}>More to make yours</h3>
        <div className={a.actions}>
          <Button onClick={() => goSection('profile')}>Profile card and badges</Button>
          <Button onClick={() => goSection('theme')}>Theme and animations</Button>
          <Button onClick={editLayout}>Order and hide modules</Button>
        </div>
      </section>
    </>
  );
}

/** A small sample of the app in your settings: name, numbers, a date and time, the game colours, a button and a link. */
function Preview({ games, now }: { games: GameContract[]; now: number }) {
  return (
    <section className={`${a.card} ${a.preview}`} aria-label="Preview">
      <span className={a.label}>Preview</span>
      <div className={a.previewRow}>
        {games.map((g) => (
          <GameTag key={g.id} label={g.short} vent={g.vent} />
        ))}
        <span className={a.previewTitle}>Tonight’s run</span>
      </div>
      <p className={a.text}>
        Daily reset at <strong>{formatTime(now + 3 * 3_600_000)}</strong> · banner ends <strong>{formatDate(now + 9 * 86_400_000)}</strong> · bank{' '}
        <strong className={a.previewNumber}>{formatNumber(12480)}</strong>
      </p>
      <div className={a.previewRow}>
        <Button variant="primary">A button</Button>
        <span className={a.previewLink}>A link in your accent</span>
      </div>
    </section>
  );
}

function GameColours({ games, prefs }: { games: GameContract[]; prefs: Prefs }) {
  const chosen = prefs.gameVents ?? {};
  const set = (game: string, value: string | null) =>
    updatePrefs((p) => ({ ...p, gameVents: compact({ ...(p.gameVents ?? {}), [game]: value ?? undefined }) as Record<string, string> }));
  return (
    <Card id="colours" title="Game colours" changed={Object.keys(chosen).length > 0}>
      <p className={a.small}>Each game’s colour runs through its pages, tags and bars. Every choice here passes the same readability rules as the game’s own.</p>
      {games.map((g) => {
        const own = chosen[g.id] === undefined;
        return (
          <Row key={g.id} label={g.name}>
            <div className={a.accentRow} role="radiogroup" aria-label={`${g.short} colour`}>
              <button type="button" role="radio" aria-checked={own} className={a.accentChip} style={{ '--chip': 'var(--ink-3)' } as CSSProperties} onClick={() => set(g.id, null)}>
                <span className={a.accentDot} aria-hidden="true" />
                The game’s own
              </button>
              {VENT_CHOICES.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  role="radio"
                  aria-checked={!own && chosen[g.id]?.toLowerCase() === v.value.toLowerCase()}
                  className={a.accentChip}
                  style={{ '--chip': v.value } as CSSProperties}
                  onClick={() => set(g.id, v.value)}
                >
                  <span className={a.accentDot} aria-hidden="true" />
                  {v.label}
                </button>
              ))}
            </div>
          </Row>
        );
      })}
    </Card>
  );
}

function ThemeSelect({ label, value, onChange }: { label: string; value: ThemeChoice; onChange: (v: ThemeChoice) => void }) {
  const owners = useOwnerThemes();
  return (
    <label className={a.small}>
      {label}{' '}
      <select className={a.input} style={{ maxWidth: 220 }} value={value} onChange={(e) => onChange(e.target.value as ThemeChoice)}>
        {THEMES.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
        {owners.status === 'ready' &&
          owners.themes.map((t) => (
            <option key={t.id} value={`owner:${t.id}`}>
              {t.name} (only for you)
            </option>
          ))}
      </select>
    </label>
  );
}

function Schedule({ games, prefs }: { games: GameContract[]; prefs: Prefs }) {
  const s = cleanSchedule(prefs.themeSchedule);
  const base = (typeof prefs.theme === 'string' ? prefs.theme : 'dark') as ThemeChoice;
  const set = (next: ThemeSchedule | null) =>
    updatePrefs((p) => (next ? { ...p, themeSchedule: next } : without(p, ['themeSchedule'])));
  const mode = s?.mode ?? 'off';
  const scopes = [...(games.length > 1 ? (['all'] as const) : []), ...games.map((g) => g.id)];
  return (
    <Card id="schedule" title="Theme schedule" changed={s !== null}>
      <Segmented
        label="Theme schedule"
        value={mode}
        onChange={(m) =>
          set(
            m === 'off'
              ? null
              : m === 'day-night'
                ? { mode: 'day-night', day: base === 'dark' ? 'light' : base, night: 'dark', dayFrom: '07:00', nightFrom: '19:00' }
                : { mode: 'per-game', themes: Object.fromEntries(scopes.map((sc) => [sc, base])) },
          )
        }
        options={[
          { id: 'off', label: 'One theme' },
          { id: 'day-night', label: 'Day and night' },
          { id: 'per-game', label: 'One per game' },
        ]}
      />
      {s?.mode === 'day-night' && (
        <div className={a.scheduleGrid}>
          <ThemeSelect label="By day" value={s.day} onChange={(v) => set({ ...s, day: v })} />
          <label className={a.small}>
            from <input className={a.input} type="time" value={s.dayFrom} onChange={(e) => e.target.value && set({ ...s, dayFrom: e.target.value })} />
          </label>
          <ThemeSelect label="By night" value={s.night} onChange={(v) => set({ ...s, night: v })} />
          <label className={a.small}>
            from <input className={a.input} type="time" value={s.nightFrom} onChange={(e) => e.target.value && set({ ...s, nightFrom: e.target.value })} />
          </label>
        </div>
      )}
      {s?.mode === 'per-game' && (
        <div className={a.scheduleGrid}>
          {scopes.map((sc) => (
            <ThemeSelect
              key={sc}
              label={sc === 'all' ? 'All games' : (games.find((g) => g.id === sc)?.name ?? sc)}
              value={s.themes[sc] ?? base}
              onChange={(v) => set({ ...s, themes: { ...s.themes, [sc]: v } })}
            />
          ))}
        </div>
      )}
      <p className={a.small}>
        {mode === 'off'
          ? `Always ${themeInfo(prefs.theme).name} (Account → Theme).`
          : mode === 'day-night'
            ? 'Switches by itself at those times, in your own time zone.'
            : 'Each game, and All games, keeps its own theme while you’re on it.'}
      </p>
    </Card>
  );
}

function LayoutCard({ games, prefs, editLayout }: { games: GameContract[]; prefs: Prefs; editLayout: () => void }) {
  const withTabs = Object.values(MODULES).filter((m) => m.tabs && m.tabs.length > 1);
  const setTab = (m: ModuleId, tab: string) =>
    updatePrefs((p) => ({ ...p, startTabs: compact({ ...(p.startTabs ?? {}), [m]: tab }) }));
  const setField = (k: 'startModule' | 'defaultScope', v: string) => updatePrefs((p) => (v ? { ...p, [k]: v } : without(p, [k])));
  const changed = Boolean(prefs.startModule || prefs.defaultScope || Object.keys(prefs.startTabs ?? {}).length);
  return (
    <Card id="layout" title="Layout" changed={changed}>
      <div className={a.scheduleGrid}>
        <label className={a.small}>
          Open HLITH on{' '}
          <select className={a.input} style={{ maxWidth: 240 }} value={prefs.startModule ?? ''} onChange={(e) => setField('startModule', e.target.value)} aria-label="Start screen">
            <option value="">The screen I had open last</option>
            {Object.values(MODULES).map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        {games.length > 1 && (
          <label className={a.small}>
            in{' '}
            <select className={a.input} style={{ maxWidth: 240 }} value={prefs.defaultScope ?? ''} onChange={(e) => setField('defaultScope', e.target.value)} aria-label="Default game">
              <option value="">All games</option>
              {games.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {withTabs.map((m) => (
          <label key={m.id} className={a.small}>
            {m.label} opens on{' '}
            <select className={a.input} style={{ maxWidth: 200 }} value={prefs.startTabs?.[m.id] ?? ''} onChange={(e) => setTab(m.id, e.target.value)} aria-label={`${m.label} opens on`}>
              <option value="">{m.tabs?.[0]?.label} (first tab)</option>
              {m.tabs?.slice(1).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <p className={a.small}>A link that names a screen still opens that screen. A hidden module can’t be the start screen; the first one in your layout opens instead.</p>
      <div className={a.actions}>
        <Button onClick={editLayout}>Order and hide modules</Button>
      </div>
    </Card>
  );
}

const TILE_PART_LABEL: Record<TilePart, string> = { copies: 'Copies (E0, M1…)', element: 'Element dot', rarity: 'Rarity', role: 'Role and element line', tags: 'Your tags' };

function RosterCard({ prefs }: { prefs: Prefs }) {
  const roster = prefs.roster ?? {};
  const hidden = roster.hideOnTile ?? [];
  const set = (change: Partial<NonNullable<Prefs['roster']>>) => updatePrefs((p) => ({ ...p, roster: { ...p.roster, ...change } }));
  return (
    <Card id="roster" title="Roster" changed={Object.keys(roster).length > 0}>
      <Row label="Tile size">
        <Segmented
          label="Tile size"
          value={roster.tileSize ?? 'normal'}
          onChange={(v) => set({ tileSize: v })}
          options={[
            { id: 'small', label: 'Small' },
            { id: 'normal', label: 'Normal' },
            { id: 'large', label: 'Large' },
          ]}
        />
      </Row>
      <span className={a.small}>A tile shows</span>
      {TILE_PARTS.map((part) => (
        <Switch
          key={part}
          label={TILE_PART_LABEL[part]}
          checked={!hidden.includes(part)}
          onChange={(on) => set({ hideOnTile: on ? hidden.filter((x) => x !== part) : [...hidden, part] })}
        />
      ))}
      <p className={a.small}>
        Roster remembers your last sort and filters. Nicknames and your own tags (“main team”, “to build”) are set on each character’s page and can be searched and filtered.
      </p>
      {roster.view && Object.keys(roster.view).length > 0 && (
        <div className={a.actions}>
          <Button variant="quiet" onClick={() => set({ view: {} })}>
            Forget my Roster filters
          </Button>
        </div>
      )}
    </Card>
  );
}

function ListsCard({ prefs, tone }: { prefs: Prefs; tone: 'dark' | 'light' }) {
  const hidden = hiddenKinds(prefs.hiddenEventKinds);
  const colours = prefs.eventKindColours ?? {};
  const setColour = (kind: string, id: string | null) => updatePrefs((p) => ({ ...p, eventKindColours: compact({ ...(p.eventKindColours ?? {}), [kind]: id ?? undefined }) as Record<string, string> }));
  const changed = hidden.length > 0 || Object.keys(colours).length > 0 || Boolean(prefs.bannerView);
  return (
    <Card id="lists" title="Events, banners and calendar" changed={changed}>
      <Row label="Banners">
        <Segmented
          label="Banners"
          value={prefs.bannerView ?? 'cards'}
          onChange={(v) => updatePrefs((p) => (v === 'cards' ? without(p, ['bannerView']) : { ...p, bannerView: v }))}
          options={[
            { id: 'cards', label: 'Big cards' },
            { id: 'list', label: 'Compact list' },
          ]}
        />
      </Row>
      <span className={a.small}>Kinds of event you see (Events and Calendar), and a colour for each</span>
      {EVENT_KINDS.map((kind) => (
        <div key={kind} className={a.kindRow}>
          <Switch
            label={KIND_LABEL[kind]}
            checked={!hidden.includes(kind)}
            onChange={(on) => updatePrefs((p) => ({ ...p, hiddenEventKinds: on ? hidden.filter((k) => k !== kind) : [...hidden, kind] }))}
          />
          <div className={a.accentRow} role="radiogroup" aria-label={`${KIND_LABEL[kind]} colour`}>
            <button type="button" role="radio" aria-checked={!colours[kind]} className={a.accentChip} style={{ '--chip': 'var(--ink-4)' } as CSSProperties} onClick={() => setColour(kind, null)}>
              <span className={a.accentDot} aria-hidden="true" />
              Default
            </button>
            {ACCENTS.filter((id) => id !== 'theme').map((id) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={colours[kind] === id}
                aria-label={`${KIND_LABEL[kind]}: ${ACCENT_LABEL[id]}`}
                className={a.swatch}
                style={{ '--chip': ACCENT_VALUE[id as Exclude<typeof id, 'theme'>][tone] } as CSSProperties}
                onClick={() => setColour(kind, id)}
              />
            ))}
          </div>
        </div>
      ))}
      <p className={a.small}>Hidden kinds still count toward what you can earn in Pulls; they just don’t show here. Countdown style is under Time and format.</p>
    </Card>
  );
}
