import { useEffect, useState } from 'react';
import type { GameContract, Material, Weapon } from '../../core/contract';
import { formatNumber } from '../../core/time/format';
import { NoData } from '../../core/ui';
import { weaponFarmPlan } from '../farm/plan';
import r from './roster.module.css';
import type { RosterData } from './useRosterData';

interface Props {
  data: RosterData;
  weapon: Weapon;
  onBack: () => void;
}

export function WeaponPage({ data, weapon: w, onBack }: Props) {
  const { game } = data;
  const t = game.terms;
  const rarity = t.rarity[w.rarity] ?? w.rarity;

  return (
    <div className={r.page}>
      <div className={r.pageBar}>
        <button type="button" className={r.backBtn} onClick={onBack}>
          ← {t.weapon}s
        </button>
      </div>

      <div className={r.hero}>
        <div className={r.heroArt}>
          {w.icon ? (
            <img src={w.icon} alt="" loading="eager" decoding="async" />
          ) : (
            <span className={r.artInitials}>{w.name.slice(0, 2)}</span>
          )}
        </div>
        <div className={r.heroInfo}>
          <div className={r.chips}>
            <span className={r.chip}>{rarity}</span>
            {w.role && <span className={r.chip}>{w.role}</span>}
            {w.source && <span className={r.chip}>{w.source}</span>}
          </div>
          <h2 className={r.heroName}>{w.name}</h2>
          {w.madeFor && <span className={r.muted}>Signature {t.weapon.toLowerCase()} for {w.madeFor}</span>}
        </div>
      </div>

      {w.effect && (
        <section className={r.card}>
          <h3 className={r.cardTitle}>Effect</h3>
          <div className={r.cardText}>
            <strong>{w.effect.name}</strong>
          </div>
          <p className={r.cardText}>{w.effect.text}</p>
        </section>
      )}

      <WeaponMaterials data={data} weapon={w} />
    </div>
  );
}

function useWeaponMaterials(game: GameContract): Material[] | null {
  const [state, setState] = useState<{ id: string; list: Material[] } | null>(null);
  const needed = Boolean(game.rules.weaponMaterialsFor);
  useEffect(() => {
    if (!needed) return;
    let alive = true;
    void game.data.materials().then((list) => {
      if (alive) setState({ id: game.id, list });
    });
    return () => {
      alive = false;
    };
  }, [game, needed]);
  if (!needed) return [];
  return state?.id === game.id ? state.list : null;
}

function WeaponMaterials({ data, weapon: w }: { data: RosterData; weapon: Weapon }) {
  const { game } = data;
  const materials = useWeaponMaterials(game);
  const real = materials ? weaponFarmPlan(game, [w.id], materials) : null;
  return (
    <section className={r.card} aria-labelledby="weapon-materials-max">
      <div className={r.cardHead}>
        <h3 className={r.cardTitle} id="weapon-materials-max">
          Materials to max
        </h3>
      </div>
      {real === null ? (
        <p className={r.muted}>Loading…</p>
      ) : real.needs.known ? (
        real.needs.value.map((m) => (
          <div key={m.material} className={r.matRow}>
            <div className={r.matTop}>
              <span className={r.matName}>
                {m.icon && <img className={r.itemIconSm} src={m.icon} alt="" loading="lazy" decoding="async" />}
                <span className={r.lineLabel}>{m.name}</span>
              </span>
              <span className={r.mono}>need {formatNumber(m.amount)}</span>
            </div>
            <span className={r.track} aria-hidden="true" />
            <span className={r.statNoData}>Have: no data yet</span>
          </div>
        ))
      ) : (
        <p className={r.cardText}>
          {game.terms.weapon} material amounts: <NoData dash={false} /> That part is on us, not you.
        </p>
      )}
      {real?.partial && <span className={r.muted}>{real.partial}</span>}
      {real?.needs.known && game.rules.materialsNote && <span className={r.muted}>{game.rules.materialsNote}</span>}
    </section>
  );
}
