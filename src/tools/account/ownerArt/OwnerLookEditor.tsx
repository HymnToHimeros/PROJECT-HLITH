import { BadgeMark } from '../BadgeMark';
import p from '../profile.module.css';
import { OWNER_BADGE_ART, OWNER_FRAME_ART, OWNER_FRAME_VARIANTS, OWNER_NAME_INFO } from './art';
import { OwnerBadge, OwnerFrame, OwnerName } from './OwnerArt';
import o from './ownerLook.module.css';
import { OWNER_SETS, wearSet, wornSet, type OwnerStyle } from './style';

/**
 * Profile → Customise → Your owner look (T64, owner only): the eight full sets (a badge with
 * the frame and name style made for it) with "Wear full set", and every badge, frame and name
 * style on its own, to mix freely. Loaded only for the owner.
 */
export default function OwnerLookEditor({ value, onChange, name }: { value: OwnerStyle; onChange: (next: OwnerStyle) => void; name: string }) {
  const worn = wornSet(value);
  const sample = name.trim() || 'The Owner';
  return (
    <section className={p.editCard} aria-label="Your owner look">
      <h3 className={p.cardTitle}>Your owner look</h3>
      <p className={p.muted}>Only you can wear these, and a card shows them only for the owner. They move as Account → Theme → Animations says: Reduced keeps a soft glow, Off holds them still.</p>

      <div className={p.field}>
        <span className={p.fieldLabel}>Full sets</span>
        <ul className={o.sets}>
          {OWNER_SETS.map((s) => {
            const on = worn?.id === s.id;
            return (
              <li key={s.id} className={o.set} data-on={on}>
                <div className={o.setArt}>
                  <OwnerBadge n={s.badge} size={52} />
                  <OwnerFrame n={s.frame} src={null} letter={sample} size={72} />
                </div>
                <span className={o.setName}>
                  <OwnerName n={s.nameStyle} text={s.name} />
                </span>
                <button type="button" className={p.pinChip} aria-pressed={on} onClick={() => onChange(wearSet(s))}>
                  {on ? 'Wearing this set' : 'Wear full set'}
                </button>
              </li>
            );
          })}
        </ul>
        <span className={p.muted}>Mixing is fine: pick any badge, frame and name style below.</span>
      </div>

      <div className={p.field}>
        <span className={p.fieldLabel}>Owner badge</span>
        <div className={p.frameRow} role="radiogroup" aria-label="Owner badge">
          <button type="button" role="radio" aria-checked={value.badge === 0} className={p.frameChoice} onClick={() => onChange({ ...value, badge: 0 })}>
            <BadgeMark id="owner" size={48} />
            <span>0 · The Eye in the Sky</span>
          </button>
          {OWNER_BADGE_ART.map((b, i) => (
            <button key={b.name} type="button" role="radio" aria-checked={value.badge === i + 1} className={p.frameChoice} title={b.line} onClick={() => onChange({ ...value, badge: i + 1 })}>
              <OwnerBadge n={i + 1} size={48} />
              <span>
                {i + 1} · {b.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className={p.field}>
        <span className={p.fieldLabel}>Owner frame</span>
        <div className={p.frameRow} role="radiogroup" aria-label="Owner frame">
          <button type="button" role="radio" aria-checked={value.frame === null} className={p.frameChoice} onClick={() => onChange({ ...value, frame: null })}>
            <span className={o.none}>Aa</span>
            <span>My normal frame</span>
          </button>
          {OWNER_FRAME_ART.map((f, i) => (
            <button key={f.name} type="button" role="radio" aria-checked={value.frame === i + 1} className={p.frameChoice} title={f.line} onClick={() => onChange({ ...value, frame: i + 1, frameVariant: 0 })}>
              <span className={o.frameCell}>
                <OwnerFrame n={i + 1} src={null} letter={sample} size={64} />
              </span>
              <span>
                {i + 1} · {OWNER_FRAME_VARIANTS[i + 1] ? `${f.name} +${(OWNER_FRAME_VARIANTS[i + 1]?.length ?? 1) - 1}` : f.name}
              </span>
            </button>
          ))}
        </div>
        {value.frame !== null && OWNER_FRAME_VARIANTS[value.frame] && (
          <div className={o.variants}>
            <span className={p.fieldLabel}>Frame {value.frame} variants</span>
            <div className={p.frameRow} role="radiogroup" aria-label={`Frame ${value.frame} variants`}>
              {OWNER_FRAME_VARIANTS[value.frame]?.map((v, k) => (
                <button key={v.name} type="button" role="radio" aria-checked={value.frameVariant === k} className={p.frameChoice} title={v.line} onClick={() => onChange({ ...value, frameVariant: k })}>
                  <span className={o.frameCell}>
                    <OwnerFrame n={value.frame as number} variant={k} src={null} letter={sample} size={64} />
                  </span>
                  <span>
                    {String.fromCharCode(65 + k)} · {v.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className={p.field}>
        <span className={p.fieldLabel}>Owner name style</span>
        <div className={o.names} role="radiogroup" aria-label="Owner name style">
          <button type="button" role="radio" aria-checked={value.name === null} className={o.nameChoice} onClick={() => onChange({ ...value, name: null })}>
            <span className={o.nameSample}>{sample}</span>
            <span className={o.nameLabel}>My normal name colour</span>
          </button>
          {OWNER_NAME_INFO.map((n, i) => (
            <button key={n.name} type="button" role="radio" aria-checked={value.name === i + 1} className={o.nameChoice} title={n.line} onClick={() => onChange({ ...value, name: i + 1 })}>
              <span className={o.nameSample}>
                <OwnerName n={i + 1} text={sample} />
              </span>
              <span className={o.nameLabel}>
                {i + 1} · {n.name}
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
