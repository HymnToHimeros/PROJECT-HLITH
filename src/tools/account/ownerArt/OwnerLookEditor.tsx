import { useId, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useIsPhone } from '../../../core/shell/useIsPhone';
import { BadgeMark } from '../BadgeMark';
import p from '../profile.module.css';
import { OWNER_BADGE_ART, OWNER_FRAME_ART, OWNER_FRAME_VARIANTS, OWNER_NAME_INFO } from './art';
import { OwnerBadge, OwnerFrame, OwnerName } from './OwnerArt';
import { OWNER_NAME_VARIANTS } from './nameVariants';
import o from './ownerLook.module.css';
import { OWNER_SETS, wearSet, wornSet, type OwnerStyle } from './style';

/**
 * Profile → Customise → Your owner look (T64, owner only): the eight full sets (a badge with
 * the frame and name style made for it) with "Wear full set", then badges, frames and name
 * styles grouped one tile per set (plus "Classic" for the earlier rounds). Tapping a tile opens
 * its variants: a row under the tiles on a PC, a sheet from the bottom on a phone (owner: "so
 * things don't get crowded"). Loaded only for the owner.
 */

interface Choice {
  key: string;
  label: string;
  line?: string | undefined;
  art: ReactNode;
  on: boolean;
  pick: () => void;
}
interface Family {
  id: string;
  label: string;
  choices: Choice[];
}

const CLASSIC = 12;
const letter = (k: number) => String.fromCharCode(65 + k);

function FamilyPicker({ label, families, wide = false }: { label: string; families: Family[]; wide?: boolean }) {
  const id = useId();
  const [open, setOpen] = useState<string | null>(null);
  const openFamily = families.find((f) => f.id === open) ?? null;
  // On a phone the variants rise as a sheet. It goes to the page's end so no parent box can trap it.
  const phone = useIsPhone();
  const place = (sheet: ReactNode) => (phone ? createPortal(sheet, document.body) : sheet);
  return (
    <div className={p.field}>
      <span className={p.fieldLabel}>{label}</span>
      <div className={wide ? o.tilesWide : o.tiles} role="group" aria-label={label}>
        {families.map((f) => {
          const chosen = f.choices.find((c) => c.on);
          const shown = chosen ?? f.choices[0];
          const many = f.choices.length > 1;
          return (
            <button
              key={f.id}
              type="button"
              className={o.tile}
              data-on={Boolean(chosen)}
              aria-expanded={many ? open === f.id : undefined}
              aria-controls={many ? `${id}-panel` : undefined}
              aria-pressed={many ? undefined : Boolean(chosen)}
              onClick={() => (many ? setOpen(open === f.id ? null : f.id) : f.choices[0]?.pick())}
            >
              <span className={o.tileArt}>{shown?.art}</span>
              <span className={o.tileLabel}>{f.label}</span>
              {many && (
                <span className={o.count}>
                  {chosen ? `${chosen.label} · ` : ''}
                  {f.choices.length} {f.id === 'classic' ? 'styles' : 'variants'}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {openFamily &&
        place(
          <>
            <button type="button" className={o.backdrop} aria-label="Close" onClick={() => setOpen(null)} />
            <div className={o.panel} id={`${id}-panel`}>
              <div className={o.panelHead}>
                <span className={p.fieldLabel}>
                  {openFamily.label} · {openFamily.choices.length} {openFamily.id === 'classic' ? 'styles' : 'variants'}
                </span>
                <button type="button" className={p.pinChip} onClick={() => setOpen(null)}>
                  Done
                </button>
              </div>
              <div className={wide ? o.choicesWide : o.choices} role="radiogroup" aria-label={`${openFamily.label} ${label.toLowerCase()}`}>
                {openFamily.choices.map((c) => (
                  <button key={c.key} type="button" role="radio" aria-checked={c.on} className={wide ? o.nameChoice : p.frameChoice} title={c.line} onClick={c.pick}>
                    <span className={wide ? o.nameSample : o.frameCell}>{c.art}</span>
                    <span className={wide ? o.nameLabel : undefined}>{c.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </>,
        )}
    </div>
  );
}

export default function OwnerLookEditor({ value, onChange, name }: { value: OwnerStyle; onChange: (next: OwnerStyle) => void; name: string }) {
  const worn = wornSet(value);
  const sample = name.trim() || 'The Owner';

  const badgeFamilies: Family[] = [
    {
      id: 'b0',
      label: 'The Eye in the Sky',
      choices: [
        {
          key: 'b0',
          label: '0 · The Eye in the Sky',
          art: <BadgeMark id="owner" size={48} />,
          on: value.badge === 0,
          pick: () => onChange({ ...value, badge: 0 }),
        },
      ],
    },
    ...OWNER_BADGE_ART.map((b, i) => ({
      id: `b${i + 1}`,
      label: b.name,
      choices: [
        {
          key: `b${i + 1}`,
          label: `${i + 1} · ${b.name}`,
          line: b.line,
          art: <OwnerBadge n={i + 1} size={48} />,
          on: value.badge === i + 1,
          pick: () => onChange({ ...value, badge: i + 1 }),
        },
      ],
    })),
  ];

  const frameChoice = (n: number, k = 0): Choice => {
    const art = OWNER_FRAME_VARIANTS[n]?.[k] ?? OWNER_FRAME_ART[n - 1];
    const many = (OWNER_FRAME_VARIANTS[n]?.length ?? 1) > 1;
    return {
      key: `f${n}-${k}`,
      label: many ? `${letter(k)} · ${art?.name ?? ''}` : `${n} · ${art?.name ?? ''}`,
      line: art?.line,
      art: <OwnerFrame n={n} variant={k} src={null} letter={sample} size={60} />,
      on: value.frame === n && value.frameVariant === k,
      pick: () => onChange({ ...value, frame: n, frameVariant: k }),
    };
  };
  const frameFamilies: Family[] = [
    {
      id: 'none',
      label: 'My normal frame',
      choices: [
        {
          key: 'none',
          label: 'My normal frame',
          art: <span className={o.none}>Aa</span>,
          on: value.frame === null,
          pick: () => onChange({ ...value, frame: null, frameVariant: 0 }),
        },
      ],
    },
    {
      id: 'classic',
      label: 'Classic',
      choices: Array.from({ length: CLASSIC }, (_, i) => frameChoice(i + 1)),
    },
    ...OWNER_SETS.map((s) => ({
      id: `fs${s.id}`,
      label: s.name,
      choices: (OWNER_FRAME_VARIANTS[s.frame] ?? [null]).map((_, k) => frameChoice(s.frame, k)),
    })),
  ];

  const nameChoice = (n: number, k = 0): Choice => {
    const variants = OWNER_NAME_VARIANTS[n];
    const info = k > 0 ? variants?.[k - 1] : OWNER_NAME_INFO[n - 1];
    return {
      key: `n${n}-${k}`,
      label: variants ? `${letter(k)} · ${info?.name ?? ''}` : `${n} · ${info?.name ?? ''}`,
      line: info?.line,
      art: <OwnerName n={n} variant={k} text={sample} />,
      on: value.name === n && value.nameVariant === k,
      pick: () => onChange({ ...value, name: n, nameVariant: k }),
    };
  };
  const nameFamilies: Family[] = [
    {
      id: 'none',
      label: 'My normal name colour',
      choices: [
        {
          key: 'none',
          label: 'My normal name colour',
          art: <span>{sample}</span>,
          on: value.name === null,
          pick: () => onChange({ ...value, name: null, nameVariant: 0 }),
        },
      ],
    },
    {
      id: 'classic',
      label: 'Classic',
      choices: Array.from({ length: CLASSIC }, (_, i) => nameChoice(i + 1)),
    },
    ...OWNER_SETS.map((s) => ({
      id: `ns${s.id}`,
      label: s.name,
      choices: Array.from({ length: (OWNER_NAME_VARIANTS[s.nameStyle]?.length ?? 0) + 1 }, (_, k) => nameChoice(s.nameStyle, k)),
    })),
  ];

  return (
    <section className={p.editCard} aria-label="Your owner look">
      <h3 className={p.cardTitle}>Your owner look</h3>
      <p className={p.muted}>
        Only you can wear these. Everyone who opens your card sees them, moving as their own Account → Theme → Animations says: Reduced keeps a soft glow, Off holds them still.
      </p>

      <div className={p.field}>
        <span className={p.fieldLabel}>Full sets</span>
        <ul className={o.sets}>
          {OWNER_SETS.map((s) => {
            const on = worn?.id === s.id;
            const fv = value.frame === s.frame ? value.frameVariant : 0;
            const nv = value.name === s.nameStyle ? value.nameVariant : 0;
            return (
              <li key={s.id} className={o.set} data-on={on}>
                <div className={o.setArt}>
                  <OwnerBadge n={s.badge} size={52} />
                  <OwnerFrame n={s.frame} variant={fv} src={null} letter={sample} size={72} />
                </div>
                <span className={o.setName}>
                  <OwnerName n={s.nameStyle} variant={nv} text={s.name} />
                </span>
                <button type="button" className={p.pinChip} aria-pressed={on} onClick={() => onChange({ ...wearSet(s), frameVariant: fv, nameVariant: nv })}>
                  {on ? 'Wearing this set' : 'Wear full set'}
                </button>
              </li>
            );
          })}
        </ul>
        <span className={p.muted}>Mixing is fine: pick any badge, frame and name style below. A set with variants keeps the one you chose.</span>
      </div>

      <FamilyPicker label="Owner badge" families={badgeFamilies} />
      <FamilyPicker label="Owner frame" families={frameFamilies} />
      <FamilyPicker label="Owner name style" families={nameFamilies} wide />
    </section>
  );
}
