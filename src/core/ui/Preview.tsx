import { useState, type CSSProperties } from 'react';
import { known, unknown } from '../contract/known';
import { formatNumber } from '../time/format';
import p from './Preview.module.css';
import {
  BannerCard,
  BottomSheet,
  Button,
  CalendarBar,
  CharacterTile,
  CurrencyChip,
  DragHandleRow,
  EmptyState,
  EventRow,
  GameTag,
  ProgressBar,
  Segmented,
  StatTile,
  Timer,
  UnverifiedTag,
} from './index';

/**
 * Every Layer 4 component in every state, on sample data. Open at /preview.
 * Sample names are neutral on purpose: core/ knows no game.
 */
const VENTS = [
  { id: 'all', label: 'All games', hex: '#CFE3EF' },
  { id: 'a', label: 'Vent A', hex: '#A99BFF' },
  { id: 'b', label: 'Vent B', hex: '#D4F23A' },
] as const;

const COLOURS: [string, string][] = [
  ['bg.app', 'var(--bg-app)'],
  ['bg.shell', 'var(--bg-shell)'],
  ['bg.card', 'var(--bg-card)'],
  ['bg.inset', 'var(--bg-inset)'],
  ['bg.raised', 'var(--bg-raised)'],
  ['line.empty', 'var(--line-empty)'],
  ['ink.1', 'var(--ink-1)'],
  ['ink.2', 'var(--ink-2)'],
  ['ink.3', 'var(--ink-3)'],
  ['ink.4', 'var(--ink-4)'],
  ['ink.5 (lightened)', 'var(--ink-5)'],
  ['glacier', 'var(--glacier)'],
  ['ok', 'var(--ok)'],
  ['ember', 'var(--ember)'],
  ['ember.soft', 'var(--ember-soft)'],
  ['rarity.top', 'var(--rarity-top)'],
  ['rarity.mid', 'var(--rarity-mid)'],
];

const HOUR = 3_600_000;

export function Preview() {
  const [vent, setVent] = useState<(typeof VENTS)[number]['id']>('a');
  const [tab, setTab] = useState<'planner' | 'calculator' | 'log' | 'history'>('planner');
  const [sheet, setSheet] = useState(false);
  const [now] = useState(() => Date.now());
  const ventHex = VENTS.find((v) => v.id === vent)?.hex ?? VENTS[0].hex;

  return (
    <main className={p.page} style={{ '--vent': ventHex } as CSSProperties}>
      <header className={p.header}>
        <div>
          <div className="t-label">PROJECT-HLITH · LAYER 4 PREVIEW</div>
          <h1 className="t-display" style={{ margin: 0 }}>
            HLIÐSKJÁLF
          </h1>
          <p className={p.intro}>Every shared part, every state. Switch the vent to see how a game tints them.</p>
        </div>
        <Segmented label="Vent" options={VENTS.map((v) => ({ id: v.id, label: v.label }))} value={vent} onChange={setVent} />
      </header>

      <section className={p.cell}>
        <h2 className="t-label">Colour</h2>
        <div className={p.swatches}>
          {COLOURS.map(([name, value]) => (
            <div key={name} className={p.swatch}>
              <span className={p.chipColour} style={{ background: value }} />
              {name}
            </div>
          ))}
        </div>
      </section>

      <div className={p.grid}>
        <section className={p.cell}>
          <h2 className="t-label">Stat tile · value / no data</h2>
          <StatTile
            label="Stamina"
            value={known('212/240', 'hoyolab')}
            progress={212 / 240}
            caption={<Timer to={now + 2.8 * HOUR} deadline prefix="Full in" />}
            urgent
            tag={{ label: 'GAME', vent: ventHex }}
          />
          <StatTile label="Second stamina" value={unknown('connect-account')} onFix={() => {}} />
        </section>

        <section className={p.cell}>
          <h2 className="t-label">Progress · chip · tags</h2>
          <div className={p.panel}>
            <ProgressBar label="Upgrade materials" value={known({ done: 12, total: 18 }, 'user')} />
            <ProgressBar label="Credits" value={unknown()} />
            <CurrencyChip name="Premium currency" amount={known(14280, 'user')} />
            <CurrencyChip name="Pull item" amount={unknown()} />
            <div className={p.row}>
              <GameTag label="HSR" vent="#A99BFF" />
              <GameTag label="ZZZ" vent="#D4F23A" />
              <UnverifiedTag source="datamine" />
            </div>
            <p className={p.note}>Game tag shows only in All games. Unverified always shows its source.</p>
          </div>
        </section>

        <section className={p.cell}>
          <h2 className="t-label">Character tile · owned / not</h2>
          <div className={p.pair}>
            <CharacterTile name="Sample Hero" subtitle="Role · Element" rarity="top" rarityLabel="5★" elementColor="#B98AF0" owned dupes="E2" />
            <CharacterTile name="Other Hero" subtitle="Role · Element" rarity="mid" rarityLabel="4★" elementColor="#8FD3F0" owned={false} />
          </div>
        </section>

        <section className={p.cell}>
          <h2 className="t-label">Banner · event row · timer</h2>
          <BannerCard kind="Limited banner" title="Sample Hero" ends={now + 52 * HOUR} />
          <BannerCard kind="Next banner" title="Unreleased Hero" ends={now} unverified={{ source: 'leak · medium reliability' }} />
          <EventRow label="Endgame mode rotates" end={<Timer to={now + 76 * HOUR} />} />
          <EventRow label="Login event" end={<Timer to={now + 30 * HOUR} deadline />} tag={{ label: 'ZZZ', vent: '#D4F23A' }} />
        </section>

        <section className={`${p.cell} ${p.wide}`}>
          <h2 className="t-label">Calendar bar · confirmed / leak / plan</h2>
          <div className={p.stack}>
            <div className={p.lane}>
              <CalendarBar kind="confirmed" title="Limited banner" range="1–22 Oct" left={2} width={50} />
            </div>
            <div className={p.lane}>
              <CalendarBar kind="leak" title="Next banner" range="22 Oct – 12 Nov" left={52} width={46} source="leak" />
            </div>
            <div className={p.lane}>
              <CalendarBar kind="plan" title="Save pulls" range="9–31 Oct" left={20} width={60} />
            </div>
          </div>
        </section>

        <section className={`${p.cell} ${p.wide}`}>
          <h2 className="t-label">Empty state · honest data</h2>
          <EmptyState
            title="No pull history yet"
            body="Import your pull history and HLITH will plan, compute odds and grade your luck. Until then it shows no numbers."
            action={{ label: 'Import pull history', onClick: () => {} }}
          />
        </section>

        <section className={p.cell}>
          <h2 className="t-label">Segmented control</h2>
          <Segmented
            label="Pulls"
            options={[
              { id: 'planner', label: 'Planner' },
              { id: 'calculator', label: 'Calculator' },
              { id: 'log', label: 'Bank log' },
              { id: 'history', label: 'History' },
            ]}
            value={tab}
            onChange={setTab}
          />
          <h2 className="t-label">Buttons</h2>
          <div className={p.row}>
            <Button variant="primary">Primary</Button>
            <Button>Secondary</Button>
            <Button variant="quiet">Quiet link</Button>
          </div>
        </section>

        <section className={p.cell}>
          <h2 className="t-label">Drag handle · layout rows</h2>
          <div className={p.panel}>
            <DragHandleRow label="Pulls" state="normal" onHide={() => {}} />
            <DragHandleRow label="Roster · dragging" state="dragging" />
            <DragHandleRow label="Backlog · hidden" state="hidden" onRestore={() => {}} />
            <DragHandleRow label="Future module" state="not-available" />
          </div>
        </section>

        <section className={p.cell}>
          <h2 className="t-label">Bottom sheet</h2>
          <Button onClick={() => setSheet(true)}>Open the More sheet</Button>
          <p className={p.note}>Escape or a tap outside closes it.</p>
          <BottomSheet open={sheet} title="More" onClose={() => setSheet(false)}>
            <div className={p.sheetGrid}>
              <span className={p.sheetTile}>Farm</span>
              <span className={p.sheetTile}>Intel</span>
              <span className={p.sheetTile}>Events</span>
            </div>
          </BottomSheet>
        </section>

        <section className={p.cell}>
          <h2 className="t-label">Type</h2>
          <div className={p.panel}>
            <span className="t-title">Today</span>
            <span className="t-card-title">Live banners</span>
            <span>Spend stamina before the daily reset.</span>
            <span className="t-caption">Full in 03:14:00 · imported 2 days ago</span>
            <span className="t-num" style={{ fontSize: 28 }}>
              {formatNumber(14280)}
            </span>
            <span className="t-label">MODULES · HIDDEN · NO DATA YET</span>
          </div>
        </section>
      </div>
    </main>
  );
}
