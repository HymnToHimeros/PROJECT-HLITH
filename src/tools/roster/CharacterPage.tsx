import type { Character, GameContract } from '../../core/contract';
import { setRosterEntry } from '../../core/data/userData';
import { Button, NoData, initials } from '../../core/ui';
import { KitCheck } from './KitCheck';
import r from './roster.module.css';
import { dupesLabel, elementOf, entryOf, roleLabel } from './shared';
import type { RosterData } from './useRosterData';

interface Props {
  game: GameContract;
  data: RosterData;
  character: Character;
  /** Open another module (Plan pulls). */
  openPulls?: (() => void) | undefined;
}

/*
 * Interface only for build, gear and "who fits". Logic is filled by the
 * ROSTER-LOGIC workstream (build score, gear effects, team fit, if you pull);
 * until then those sections show "No data yet". Owned / wanted / dupes are
 * your own data and work now.
 */

/** One character: mark owned / wanted and dupes; facts; build, gear and who fits (or "No data yet"); Kit check. */
export function CharacterPage({ game, data, character: c, openPulls }: Props) {
  const entry = entryOf(data.user.roster, c.id);
  const el = elementOf(game, c.element);
  const save = (change: Partial<typeof entry>) => setRosterEntry(game.id, c.id, { ...entry, ...change });
  const dupes = game.dupes;
  const rarityColor = c.rarity === 'top' ? 'var(--rarity-top)' : 'var(--rarity-mid)';

  return (
    <div className={r.page}>
      <div className={r.pageTop}>
        <div className={r.pageArt} style={{ borderBottomColor: rarityColor }}>
          {c.art ? <img src={c.art} alt="" /> : <span className={r.pageInitials}>{initials(c.name)}</span>}
        </div>
        <dl className={r.facts}>
          <div>
            <dt>Rarity</dt>
            <dd style={{ color: rarityColor }}>{game.terms.rarity[c.rarity]}</dd>
          </div>
          <div>
            <dt>Element</dt>
            <dd>
              <span className={r.dot} style={{ background: el?.color ?? 'var(--ink-4)' }} aria-hidden="true" />
              {el?.label ?? c.element}
            </dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>{roleLabel(game, c.role)}</dd>
          </div>
          <div>
            <dt>Released</dt>
            <dd>{c.releasedAt ? new Date(c.releasedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : <NoData />}</dd>
          </div>
        </dl>
      </div>

      <section className={r.pageSection} aria-label="Your roster">
        <h3 className={r.sectionTitle}>Your roster</h3>
        <div className={r.toggles}>
          <label className={r.toggle}>
            <input type="checkbox" checked={entry.owned} onChange={(e) => save({ owned: e.target.checked })} />
            Owned
          </label>
          <label className={r.toggle}>
            <input type="checkbox" checked={entry.wanted} onChange={(e) => save({ wanted: e.target.checked })} />
            Wanted
          </label>
        </div>
        {dupes && (
          <div className={r.stepper} role="group" aria-label={`${dupes.name}s`}>
            <span className={r.stepperLabel}>{dupes.name}s</span>
            <Button aria-label={`One ${dupes.name} less`} disabled={!entry.owned || entry.dupes <= 0} onClick={() => save({ dupes: Math.max(0, entry.dupes - 1) })}>
              −
            </Button>
            <span className={r.stepperValue} aria-live="polite">
              {entry.owned ? dupesLabel(game, entry.dupes) : '—'}
            </span>
            <Button aria-label={`One ${dupes.name} more`} disabled={!entry.owned || entry.dupes >= dupes.max} onClick={() => save({ dupes: Math.min(dupes.max, entry.dupes + 1) })}>
              +
            </Button>
            {!entry.owned && <span className={r.muted}>Mark as owned first.</span>}
          </div>
        )}
        {!entry.owned && openPulls && (
          <Button variant="quiet" onClick={openPulls}>
            Plan pulls for {c.name} →
          </Button>
        )}
      </section>

      <section className={r.pageSection} aria-label="Build">
        <h3 className={r.sectionTitle}>Build</h3>
        <p className={r.muted}>
          Level, {game.terms.weapon} and build score come from a build import or a screenshot scan.
        </p>
        <NoData />
      </section>

      <section className={r.pageSection} aria-label={game.terms.gear}>
        <h3 className={r.sectionTitle}>{game.terms.gear}</h3>
        <p className={r.muted}>Which {game.terms.gear} to use and what they do.</p>
        <NoData />
      </section>

      <section className={r.pageSection} aria-label="Who fits">
        <h3 className={r.sectionTitle}>Who fits</h3>
        <p className={r.muted}>Teammates that suit this {game.terms.character.toLowerCase()}, and how a pull would change your teams.</p>
        <NoData />
      </section>

      <KitCheck game={game} characters={[c]} />
    </div>
  );
}
