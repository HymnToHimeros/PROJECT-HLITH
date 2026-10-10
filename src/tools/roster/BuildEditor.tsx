import { useId, useMemo, useState, type ReactNode } from 'react';
import type { BuildRules, Character, GameContract, SavedBuild } from '../../core/contract';
import { setBuild } from '../../core/data/userData';
import { BottomSheet, Button } from '../../core/ui';
import r from './roster.module.css';
import { useBuilds, useWeapons } from './useRosterData';

type Gear = SavedBuild['gear'][number];
type Sub = Gear['subs'][number];

interface Draft {
  level: string;
  weapon: string;
  weaponLevel: string;
  refine: string;
  gear: Record<string, { set: string; main: string; subs: { stat: string; value: string }[] }>;
  skills: Record<string, string>;
}

const SUBS_PER_PIECE = 4;
const str = (n: number | undefined) => (n === undefined ? '' : String(n));

function toDraft(rules: BuildRules, b: SavedBuild | undefined): Draft {
  const gear: Draft['gear'] = {};
  for (const slot of rules.slots) {
    const piece = b?.gear.find((g) => g.slot === slot.id);
    const subs = (piece?.subs ?? []).map((x) => ({ stat: x.stat, value: String(x.value) }));
    while (subs.length < SUBS_PER_PIECE) subs.push({ stat: '', value: '' });
    gear[slot.id] = { set: piece?.set ?? '', main: piece?.main ?? '', subs };
  }
  return {
    level: str(b?.level),
    weapon: b?.weapon?.name ?? '',
    weaponLevel: str(b?.weapon?.level),
    refine: str(b?.weapon?.refine),
    gear,
    skills: Object.fromEntries(rules.skills.map((s) => [s.name, str(b?.skills?.[s.name])])),
  };
}

/** A whole number from min to max, or undefined when empty. Problems go into `bad`. */
function whole(value: string, min: number, max: number, label: string, bad: string[]): number | undefined {
  const v = value.trim();
  if (!v) return undefined;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) {
    bad.push(`${label} must be a whole number from ${min} to ${max}.`);
    return undefined;
  }
  return n;
}

/** The draft as a SavedBuild, or the problems that stop it from saving. */
export function fromDraft(rules: BuildRules, d: Draft, weaponId: (name: string) => string | undefined): { build: Omit<SavedBuild, 'source' | 'updatedAt'> } | { problems: string[] } {
  const bad: string[] = [];
  const level = whole(d.level, 1, rules.levelMax, 'Level', bad);
  const name = d.weapon.trim();
  const wLevel = whole(d.weaponLevel, 1, rules.weaponLevelMax, 'Weapon level', bad);
  const refine = whole(d.refine, 1, rules.refine.max, rules.refine.name, bad);
  const gear: Gear[] = [];
  for (const slot of rules.slots) {
    const g = d.gear[slot.id];
    if (!g) continue;
    const subs: Sub[] = [];
    for (const s of g.subs) {
      const stat = s.stat.trim();
      const raw = s.value.trim();
      if (!stat && !raw) continue;
      const value = Number(raw);
      if (!stat || !raw || !Number.isFinite(value) || value < 0) bad.push(`${slot.label}: each extra stat needs a name and a number.`);
      else subs.push({ stat, value });
    }
    const set = g.set.trim();
    const main = g.main.trim();
    if (set || main || subs.length) gear.push({ slot: slot.id, ...(set ? { set } : {}), ...(main ? { main } : {}), subs });
  }
  const skills: Record<string, number> = {};
  for (const s of rules.skills) {
    const n = whole(d.skills[s.name] ?? '', 1, s.max, s.name, bad);
    if (n !== undefined) skills[s.name] = n;
  }
  if (bad.length) return { problems: [...new Set(bad)] };
  const id = name ? weaponId(name) : undefined;
  return {
    build: {
      ...(level !== undefined ? { level } : {}),
      ...(name ? { weapon: { name, ...(id ? { id } : {}), ...(wLevel !== undefined ? { level: wLevel } : {}), ...(refine !== undefined ? { refine } : {}) } } : {}),
      gear,
      ...(Object.keys(skills).length ? { skills } : {}),
    },
  };
}

function Field({ label, children, wide }: { label: string; children: (id: string) => ReactNode; wide?: boolean }) {
  const id = useId();
  return (
    <div className={wide ? `${r.buildField} ${r.buildFieldWide}` : r.buildField}>
      <label className={r.statLabel} htmlFor={id}>
        {label}
      </label>
      {children(id)}
    </div>
  );
}

interface Props {
  game: GameContract;
  character: Character;
  saved: SavedBuild | undefined;
  open: boolean;
  onClose: () => void;
}

/**
 * Edit a character's build: level, weapon, every gear piece and skill levels. Empty fields
 * stay empty (nothing is guessed). Saving replaces the saved build; Cancel keeps it.
 */
export function BuildEditor({ game, character: c, saved, open, onClose }: Props) {
  const rules = game.build;
  const weapons = useWeapons(game);
  const recommended = useBuilds(game);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const lists = useId();
  const sets = useMemo(() => [...new Set((recommended ?? []).flatMap((b) => b.sets.flatMap((s) => s.options)))].sort(), [recommended]);
  if (!rules) return null;
  const d = draft ?? toDraft(rules, saved);
  const change = (next: Partial<Draft>) => setDraft({ ...d, ...next });
  const piece = (slot: string, next: Partial<Draft['gear'][string]>) => {
    const g = d.gear[slot];
    if (g) change({ gear: { ...d.gear, [slot]: { ...g, ...next } } });
  };
  const close = () => {
    setDraft(null);
    setProblems([]);
    onClose();
  };
  const save = () => {
    const out = fromDraft(rules, d, (name) => weapons?.find((w) => w.name.toLowerCase() === name.toLowerCase())?.id);
    if ('problems' in out) {
      setProblems(out.problems);
      return;
    }
    setBuild(game.id, c.id, { ...out.build, source: 'manual', updatedAt: new Date().toISOString() });
    close();
  };
  const t = game.terms;

  return (
    <BottomSheet open={open} side title={`Edit build · ${c.name}`} onClose={close} closeButton>
      <form
        className={r.buildForm}
        aria-label={`Edit build of ${c.name}`}
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <p className={r.cardText}>Fill in what you know; empty fields stay empty. Names are as the game writes them.</p>
        <datalist id={`${lists}-weapons`}>
          {(weapons ?? []).map((w) => (
            <option key={w.id} value={w.name} />
          ))}
        </datalist>
        <datalist id={`${lists}-sets`}>
          {sets.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <datalist id={`${lists}-subs`}>
          {rules.subStats.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>

        <div className={r.buildGrid}>
          <Field label={`${c.name}’s level (1–${rules.levelMax})`}>
            {(id) => <input id={id} className={r.input} inputMode="numeric" value={d.level} onChange={(e) => change({ level: e.target.value })} />}
          </Field>
        </div>

        <h4 className={r.buildHead}>{t.weapon}</h4>
        <div className={r.buildGrid}>
          <Field label={t.weapon} wide>
            {(id) => <input id={id} className={r.input} list={`${lists}-weapons`} value={d.weapon} onChange={(e) => change({ weapon: e.target.value })} placeholder="Type to search" />}
          </Field>
          <Field label={`${t.weapon} level (1–${rules.weaponLevelMax})`}>
            {(id) => <input id={id} className={r.input} inputMode="numeric" value={d.weaponLevel} onChange={(e) => change({ weaponLevel: e.target.value })} />}
          </Field>
          <Field label={rules.refine.name}>
            {(id) => (
              <select id={id} className={r.input} value={d.refine} onChange={(e) => change({ refine: e.target.value })}>
                <option value="">Not set</option>
                {Array.from({ length: rules.refine.max }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>

        <h4 className={r.buildHead}>{t.gear}</h4>
        {rules.slots.map((slot) => {
          const g = d.gear[slot.id];
          if (!g) return null;
          return (
            <fieldset key={slot.id} className={r.buildPiece}>
              <legend className={r.buildLegend}>{slot.label}</legend>
              <div className={r.buildGrid}>
                <Field label="Set" wide>
                  {(id) => <input id={id} className={r.input} list={`${lists}-sets`} value={g.set} onChange={(e) => piece(slot.id, { set: e.target.value })} />}
                </Field>
                <Field label="Main stat">
                  {(id) => (
                    <>
                      <input id={id} className={r.input} list={`${lists}-main-${slot.id}`} value={g.main} onChange={(e) => piece(slot.id, { main: e.target.value })} placeholder={slot.mains.length === 1 ? slot.mains[0] : ''} />
                      <datalist id={`${lists}-main-${slot.id}`}>
                        {slot.mains.map((m) => (
                          <option key={m} value={m} />
                        ))}
                      </datalist>
                    </>
                  )}
                </Field>
              </div>
              <div className={r.buildSubs} role="group" aria-label={`${slot.label} extra stats`}>
                {g.subs.map((s, i) => (
                  <div key={i} className={r.buildSub}>
                    <input
                      className={r.input}
                      aria-label={`${slot.label} extra stat ${i + 1}`}
                      list={`${lists}-subs`}
                      value={s.stat}
                      onChange={(e) => piece(slot.id, { subs: g.subs.map((x, j) => (j === i ? { ...x, stat: e.target.value } : x)) })}
                    />
                    <input
                      className={r.input}
                      aria-label={`${slot.label} extra stat ${i + 1} value`}
                      inputMode="decimal"
                      value={s.value}
                      onChange={(e) => piece(slot.id, { subs: g.subs.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })}
                    />
                  </div>
                ))}
              </div>
            </fieldset>
          );
        })}

        <h4 className={r.buildHead}>{t.skill}</h4>
        <div className={r.buildGrid}>
          {rules.skills.map((s) => (
            <Field key={s.name} label={`${s.name} (1–${s.max})`}>
              {(id) => <input id={id} className={r.input} inputMode="numeric" value={d.skills[s.name] ?? ''} onChange={(e) => change({ skills: { ...d.skills, [s.name]: e.target.value } })} />}
            </Field>
          ))}
        </div>

        {problems.length > 0 && (
          <ul className={r.buildProblems} role="alert">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        <div className={r.buildActions}>
          <Button type="button" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            Save build
          </Button>
        </div>
      </form>
    </BottomSheet>
  );
}
