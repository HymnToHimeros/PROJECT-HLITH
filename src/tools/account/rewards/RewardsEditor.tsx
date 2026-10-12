import { useId, useState, type FormEvent } from 'react';
import { formatDate } from '../../../core/time/reset';
import { Button } from '../../../core/ui';
import p from '../profile.module.css';
import { setPendingClaim } from './claimLink';
import { rewardTag, showCode, codeKey, type HeldReward, type RewardItem, type WornRewards } from './model';
import type { RewardKind } from './pool';
import { RewardPreview } from './RewardArt';
import type { RewardsApi } from './rewardsData';
import r from './rewards.module.css';

const KIND_LABEL: Record<RewardKind, string> = { badge: 'Badge', frame: 'Frame', name: 'Name style' };

/** "Have a code?": claim a reward with a code or link from the owner. */
export function ClaimBox({ api, initial = '', onClaimed, compact = false }: { api: RewardsApi | null; initial?: string; onClaimed: (item: RewardItem) => void; compact?: boolean }) {
  const id = useId();
  const [code, setCode] = useState(initial ? showCode(initial) : '');
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!api || !codeKey(code)) return;
    setBusy(true);
    setSaid(null);
    void api
      .claim(code)
      .then(
        ({ status, item }) => {
          setPendingClaim(null);
          setCode('');
          setSaid({ ok: true, text: status === 'already' ? `You already hold ${item.name}.` : `${item.name} is yours. Wear it under Customise profile → Exclusive.` });
          onClaimed(item);
        },
        (err: unknown) => {
          const text = err instanceof Error ? err.message : 'That didn’t work.';
          // A code that can't be used is forgotten; a sign-in or set-up problem keeps it for later.
          if (/code/i.test(text)) setPendingClaim(null);
          setSaid({ ok: false, text: `${text.charAt(0).toUpperCase()}${text.slice(1)}.` });
        },
      )
      .finally(() => setBusy(false));
  };
  return (
    <form className={compact ? r.claimInline : r.claim} onSubmit={submit} aria-label="Claim a reward">
      <label className={p.field} htmlFor={`${id}-code`}>
        <span className={p.fieldLabel}>Have a code?</span>
        <input id={`${id}-code`} className={p.input} value={code} autoComplete="off" spellCheck={false} placeholder="ABCD-EFGH-JKLM-NPQR" maxLength={40} onChange={(e) => setCode(e.target.value)} disabled={!api} />
      </label>
      <Button type="submit" variant="primary" disabled={!api || busy || !codeKey(code)}>
        {busy ? 'Claiming…' : 'Claim'}
      </Button>
      {said && (
        <p className={said.ok ? r.ok : p.warn} role={said.ok ? 'status' : 'alert'}>
          {said.text}
        </p>
      )}
    </form>
  );
}

/**
 * Profile → Customise → Exclusive (T67): rewards the owner gave you, each with its tag
 * ("Exclusive · event · date"). Wear one badge, frame and name style; the server shows one on
 * your card only while you hold it.
 */
export function RewardsEditor({ held, worn, onWear, signedIn, api, onClaimed, name }: { held: HeldReward[]; worn: WornRewards; onWear: (w: WornRewards) => void; signedIn: boolean; api: RewardsApi | null; onClaimed: () => void; name: string }) {
  const sample = name.trim() || 'Your name';
  return (
    <section className={p.editCard} aria-label="Exclusive">
      <h3 className={p.cardTitle}>Exclusive</h3>
      {!signedIn ? (
        <p className={p.muted}>Needs an account: exclusive rewards are given to accounts, so they can’t be held on this device only.</p>
      ) : (
        <>
          <p className={p.muted}>Rewards from HLIÐSKJÁLF events and giveaways. Only you hold them; wear one of each on your card.</p>
          {held.length === 0 ? (
            <p className={p.noData}>No exclusive items yet</p>
          ) : (
            (['badge', 'frame', 'name'] as const).map((kind) => {
              const list = held.filter((h) => h.kind === kind);
              if (list.length === 0) return null;
              return (
                <div key={kind} className={p.field}>
                  <span className={p.fieldLabel}>{KIND_LABEL[kind]}</span>
                  <div className={r.choices} role="radiogroup" aria-label={`Exclusive ${KIND_LABEL[kind].toLowerCase()}`}>
                    <button type="button" role="radio" aria-checked={worn[kind] === null} className={r.choice} onClick={() => onWear({ ...worn, [kind]: null })}>
                      <span className={r.art}>
                        <span className={r.none}>—</span>
                      </span>
                      <span className={r.name}>Don’t wear one</span>
                    </button>
                    {list.map((h) => (
                      <button key={h.id} type="button" role="radio" aria-checked={worn[kind] === h.id} className={r.choice} onClick={() => onWear({ ...worn, [kind]: h.id })}>
                        <span className={r.art}>
                          <RewardPreview kind={kind} art={h.art} size={56} sample={sample} />
                        </span>
                        <span className={r.name}>{h.name}</span>
                        <span className={r.tag}>{rewardTag(h, formatDate)}</span>
                        <span className={r.when}>Got {formatDate(Date.parse(h.granted_at))}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })
          )}
          <ClaimBox api={api} onClaimed={onClaimed} compact />
        </>
      )}
    </section>
  );
}
