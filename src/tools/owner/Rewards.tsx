import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';
import { formatDate } from '../../core/time/reset';
import { Button, HowTo, NoData } from '../../core/ui';
import { claimLink } from '../account/rewards/claimLink';
import { rewardTag, showCode, type ClaimRow, type GrantRow, type OwnerItem } from '../account/rewards/model';
import { REWARD_POOL, type RewardKind } from '../account/rewards/pool';
import { RewardPreview } from '../account/rewards/RewardArt';
import { serverOwnerRewards, type OwnerRewardsApi } from '../account/rewards/rewardsData';
import r from '../account/rewards/rewards.module.css';
import o from './owner.module.css';
import { serverUsers, type UsersApi } from './usersData';

/*
 * Owner console → Rewards (T67, migration 0019). A catalogue of exclusive items (badges, frames,
 * name styles from the reward pool), given to chosen accounts by username or through claim
 * codes and links (one-time or limited, with an optional end date). Every grant, claim, revoke
 * and code is checked on the server and goes into the log on the Users tab. Nothing is deleted:
 * a revoked grant and a cancelled code stay listed. The owner's own looks are never in the pool.
 * No design yet (CLAUDE.md Override 5): the owner console's tokens and parts.
 */

const KINDS: { id: RewardKind; label: string }[] = [
  { id: 'badge', label: 'Badge' },
  { id: 'frame', label: 'Frame' },
  { id: 'name', label: 'Name style' },
];
const nameOf = (n: string | null) => n?.trim() || 'No username';
const claimState = (c: ClaimRow, now: number) => (c.cancelled_at ? 'CANCELLED' : c.expires_at && Date.parse(c.expires_at) <= now ? 'ENDED' : c.uses >= c.max_uses ? 'USED UP' : 'OPEN');

export function Rewards({
  api = serverOwnerRewards,
  users = serverUsers,
  origin = typeof window !== 'undefined' ? window.location.origin : '',
  now: nowProp,
}: {
  api?: OwnerRewardsApi | null;
  users?: UsersApi | null;
  origin?: string;
  now?: number;
}) {
  const uid = useId();
  const f = (k: string) => `${uid}-${k}`;
  const [opened] = useState(() => Date.now());
  const now = nowProp ?? opened;
  const [items, setItems] = useState<OwnerItem[] | null>(api ? null : []);
  const [claims, setClaims] = useState<ClaimRow[] | null>(api ? null : []);
  const [usernames, setUsernames] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [openItem, setOpenItem] = useState<string | null>(null);

  // New item
  const [kind, setKind] = useState<RewardKind>('badge');
  const [art, setArt] = useState<string>(REWARD_POOL.find((p) => p.kind === 'badge')?.art ?? '');
  const [name, setName] = useState(REWARD_POOL.find((p) => p.kind === 'badge')?.name ?? '');
  const [exclusive, setExclusive] = useState(true);
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');

  const reload = useCallback(() => {
    if (!api) return;
    void Promise.all([api.items(), api.claims()]).then(
      ([i, c]) => {
        setItems(i);
        setClaims(c);
      },
      (e: unknown) => {
        setItems([]);
        setClaims([]);
        setError(e instanceof Error ? e.message : 'Could not read the rewards.');
      },
    );
  }, [api]);
  useEffect(reload, [reload]);
  // Usernames to pick from when giving an item (Users tab data; the server matches ignoring case).
  useEffect(() => {
    if (!users) return;
    void users.users().then(
      (list) => setUsernames(list.flatMap((u) => (u.username ? [u.username] : [])).sort((a, b) => a.localeCompare(b))),
      () => setUsernames([]),
    );
  }, [users]);

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setSaid(null);
    try {
      await task();
      reload();
    } catch (e) {
      const m = e instanceof Error ? e.message : 'That didn’t work.';
      setError(`${m.charAt(0).toUpperCase()}${m.slice(1)}.`);
    } finally {
      setBusy(false);
    }
  };

  const pickKind = (k: RewardKind) => {
    setKind(k);
    const first = REWARD_POOL.find((p) => p.kind === k);
    setArt(first?.art ?? '');
    setName(first?.name ?? '');
  };
  const pickArt = (a: string) => {
    const prevDefault = REWARD_POOL.find((p) => p.art === art)?.name;
    setArt(a);
    if (!name.trim() || name === prevDefault) setName(REWARD_POOL.find((p) => p.art === a)?.name ?? '');
  };
  const create = (e: FormEvent) => {
    e.preventDefault();
    if (!api || !name.trim() || !art) return;
    void run(async () => {
      await api.addItem({ kind, art, name: name.trim(), exclusive, eventName: eventName.trim(), eventDate: eventDate || null });
      setSaid(`Added “${name.trim()}” to the catalogue. Give it to someone or make a claim code below.`);
      setEventName('');
      setEventDate('');
    });
  };

  return (
    <div className={o.stack}>
      <HowTo
        steps={[
          <>Add an item: pick a picture from the reward pool, name it, and add the event it’s for if you like.</>,
          <>Give it to someone by username, or make a claim code or link (one person, or a set number of people, with an end date if you want).</>,
          <>They see it under Customise profile → Exclusive with its tag, and can wear it. Revoke takes it back. Everything is in the log on the Users tab.</>,
        ]}
      />
      {!api && <p className={o.note}>This site runs without a server, so there are no rewards here.</p>}
      {error && (
        <p className={o.alert} role="alert">
          {error}
        </p>
      )}
      {said && (
        <p className={o.said} role="status">
          {said}
        </p>
      )}

      {api && (
        <form className={o.form} onSubmit={create} aria-label="New reward item">
          <h3 className={o.cardTitle}>New item</h3>
          <div className={r.choices} role="radiogroup" aria-label="Kind">
            {KINDS.map((k) => (
              <button key={k.id} type="button" role="radio" aria-checked={kind === k.id} className={r.choice} onClick={() => pickKind(k.id)}>
                <span className={r.name}>{k.label}</span>
              </button>
            ))}
          </div>
          <span className={o.note}>Picture (from the reward pool; new event designs are drawn on request)</span>
          <div className={r.choices} role="radiogroup" aria-label="Picture">
            {REWARD_POOL.filter((p) => p.kind === kind).map((p) => (
              <button key={p.art} type="button" role="radio" aria-checked={art === p.art} className={r.choice} title={p.line} onClick={() => pickArt(p.art)}>
                <span className={r.art}>
                  <RewardPreview kind={p.kind} art={p.art} size={56} sample={name.trim() || p.name} />
                </span>
                <span className={r.name}>{p.name}</span>
              </button>
            ))}
          </div>
          <label className={o.field} htmlFor={f('name')}>
            Name
            <input id={f('name')} className={o.input} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} autoComplete="off" />
          </label>
          <label className={o.field} htmlFor={f('event')}>
            Event (optional), e.g. “Launch week”
            <input id={f('event')} className={o.input} value={eventName} maxLength={60} onChange={(e) => setEventName(e.target.value)} autoComplete="off" />
          </label>
          <label className={o.field} htmlFor={f('date')}>
            Event date (optional)
            <input id={f('date')} type="date" className={o.input} value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
          </label>
          <label className={o.field}>
            <span>
              <input type="checkbox" checked={exclusive} onChange={(e) => setExclusive(e.target.checked)} /> Exclusive (tagged “Exclusive” wherever it shows)
            </span>
          </label>
          <div className={o.jobActions}>
            <Button variant="primary" type="submit" disabled={busy || !name.trim()}>
              Add item
            </Button>
          </div>
        </form>
      )}

      <section className={o.card} aria-labelledby={f('items')}>
        <h3 className={o.cardTitle} id={f('items')}>
          Items{items && items.length ? ` · ${items.length}` : ''}
        </h3>
        {items === null ? (
          <span className={o.note}>Loading…</span>
        ) : items.length === 0 ? (
          <NoData />
        ) : (
          <ul className={o.list}>
            {items.map((it) => (
              <li key={it.id} className={o.item} aria-label={it.name}>
                <span className={r.art}>
                  <RewardPreview kind={it.kind} art={it.art} size={44} sample={it.name} />
                </span>
                <span className={o.itemText}>
                  <span className={o.itemTitle}>{it.name}</span>
                  <span className={o.recordMeta}>
                    {KINDS.find((k) => k.id === it.kind)?.label} · {rewardTag(it, formatDate)} · held by {it.holders}
                  </span>
                  {openItem === it.id && api && (
                    <ItemPanel item={it} api={api} origin={origin} busy={busy} run={run} setSaid={setSaid} listId={f('users')} />
                  )}
                </span>
                <button type="button" className={o.smallBtn} aria-expanded={openItem === it.id} onClick={() => setOpenItem(openItem === it.id ? null : it.id)} aria-label={`${openItem === it.id ? 'Close' : 'Manage'}: ${it.name}`}>
                  {openItem === it.id ? 'Close' : 'Manage'}
                </button>
              </li>
            ))}
          </ul>
        )}
        <datalist id={f('users')}>
          {usernames.map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
      </section>

      <section className={o.card} aria-labelledby={f('claims')}>
        <h3 className={o.cardTitle} id={f('claims')}>
          Claim codes
        </h3>
        {claims === null ? (
          <span className={o.note}>Loading…</span>
        ) : claims.length === 0 ? (
          <NoData />
        ) : (
          <ul className={o.list}>
            {claims.map((c) => {
              const st = claimState(c, now);
              const item = items?.find((i) => i.id === c.item_id);
              const label = c.note || item?.name || 'Claim code';
              return (
                <li key={c.id} className={`${o.item} ${st === 'CANCELLED' ? o.itemRetired : ''}`} aria-label={label}>
                  <span className={`${o.tag} ${st === 'OPEN' ? o.tagOwner : ''}`}>{st}</span>
                  <span className={o.itemText}>
                    <span className={o.itemTitle}>
                      {label}
                      {item && c.note ? ` · ${item.name}` : ''}
                    </span>
                    <span className={o.recordMeta}>
                      Used {c.uses} of {c.max_uses} · made {formatDate(Date.parse(c.created_at))}
                      {c.expires_at ? ` · ends ${formatDate(Date.parse(c.expires_at))}` : ''}
                      {c.cancelled_at ? ` · cancelled ${formatDate(Date.parse(c.cancelled_at))}` : ''}
                    </span>
                  </span>
                  {st === 'OPEN' && (
                    <button
                      type="button"
                      className={o.smallBtn}
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          const ok = await api?.cancelClaim(c.id);
                          setSaid(ok ? `Cancelled “${label}”. The code and its link no longer work.` : 'That code was already cancelled.');
                        })
                      }
                      aria-label={`Cancel code: ${label}`}
                    >
                      Cancel
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

/** One item: give it by username, see who holds it (revoke), make a claim code. */
function ItemPanel({
  item,
  api,
  origin,
  busy,
  run,
  setSaid,
  listId,
}: {
  item: OwnerItem;
  api: OwnerRewardsApi;
  origin: string;
  busy: boolean;
  run: (task: () => Promise<void>) => Promise<void>;
  setSaid: (s: string | null) => void;
  listId: string;
}) {
  const uid = useId();
  const f = (k: string) => `${uid}-${k}`;
  const [grants, setGrants] = useState<GrantRow[] | null>(null);
  const [who, setWho] = useState('');
  const [reason, setReason] = useState('');
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [uses, setUses] = useState(1);
  const [ends, setEnds] = useState('');
  const [note, setNote] = useState('');
  const [made, setMade] = useState<{ code: string; link: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(() => {
    void api.grants(item.id).then(setGrants, () => setGrants([]));
  }, [api, item.id]);
  useEffect(load, [load]);
  const act = (task: () => Promise<void>) => run(task).then(load);

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
    } catch {
      setCopied(null);
    }
  };

  const active = (grants ?? []).filter((g) => !g.revoked_at);
  return (
    <span className={o.stack}>
      <form
        className={o.form}
        aria-label={`Give ${item.name}`}
        onSubmit={(e) => {
          e.preventDefault();
          const name = who.trim();
          if (!name) return;
          void act(async () => {
            const res = await api.grant(item.id, name, reason.trim());
            setSaid(res === 'already' ? `${name} already holds ${item.name}.` : `Gave ${item.name} to ${name}.`);
            setWho('');
            setReason('');
          });
        }}
      >
        <label className={o.field} htmlFor={f('who')}>
          Give to (username)
          <input id={f('who')} className={o.input} list={listId} value={who} maxLength={20} onChange={(e) => setWho(e.target.value)} autoComplete="off" placeholder="Start typing a username" />
        </label>
        <label className={o.field} htmlFor={f('why')}>
          Reason for the log (optional)
          <input id={f('why')} className={o.input} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} autoComplete="off" />
        </label>
        <div className={o.jobActions}>
          <Button type="submit" variant="primary" disabled={busy || !who.trim()}>
            Give
          </Button>
        </div>
      </form>

      <span className={o.itemTitle}>Held by{active.length ? ` · ${active.length}` : ''}</span>
      {grants === null ? (
        <span className={o.note}>Loading…</span>
      ) : grants.length === 0 ? (
        <NoData />
      ) : (
        <ul className={o.list}>
          {grants.map((g) => (
            <li key={g.id} className={`${o.item} ${g.revoked_at ? o.itemRetired : ''}`} aria-label={nameOf(g.name)}>
              <span className={o.tag}>{g.revoked_at ? 'REVOKED' : g.source === 'claim' ? 'CLAIMED' : 'GIVEN'}</span>
              <span className={o.itemText}>
                <span className={o.itemTitle}>{nameOf(g.name)}</span>
                <span className={o.recordMeta}>
                  Since {formatDate(Date.parse(g.granted_at))}
                  {g.revoked_at ? ` · revoked ${formatDate(Date.parse(g.revoked_at))}` : ''}
                </span>
                {revoking === g.id && (
                  <span className={o.confirm}>
                    <input className={o.input} value={revokeReason} maxLength={300} onChange={(e) => setRevokeReason(e.target.value)} placeholder="Reason for the log (optional)" aria-label="Reason for revoking" />
                    <span className={o.jobActions}>
                      <button
                        type="button"
                        className={o.smallBtn}
                        disabled={busy}
                        onClick={() =>
                          void act(async () => {
                            await api.revoke(g.id, revokeReason.trim());
                            setSaid(`Revoked ${item.name} from ${nameOf(g.name)}. It leaves their card.`);
                            setRevoking(null);
                            setRevokeReason('');
                          })
                        }
                      >
                        Yes, revoke
                      </button>
                      <button type="button" className={o.smallBtn} onClick={() => setRevoking(null)}>
                        Keep
                      </button>
                    </span>
                  </span>
                )}
              </span>
              {!g.revoked_at && revoking !== g.id && (
                <button type="button" className={o.smallBtn} onClick={() => setRevoking(g.id)} aria-label={`Revoke from ${nameOf(g.name)}`}>
                  Revoke
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <form
        className={o.form}
        aria-label={`New claim code for ${item.name}`}
        onSubmit={(e) => {
          e.preventDefault();
          void act(async () => {
            const endsAt = ends ? new Date(`${ends}T23:59:59`).toISOString() : null;
            const { code } = await api.createClaim(item.id, uses, endsAt, note.trim());
            setMade({ code, link: claimLink(origin, code) });
            setCopied(null);
            setNote('');
          });
        }}
      >
        <span className={o.itemTitle}>New claim code</span>
        <label className={o.field} htmlFor={f('uses')}>
          How many people can use it
          <input id={f('uses')} type="number" min={1} max={10000} className={o.input} value={uses} onChange={(e) => setUses(Math.min(10000, Math.max(1, Number.parseInt(e.target.value, 10) || 1)))} />
        </label>
        <label className={o.field} htmlFor={f('ends')}>
          Works until (optional; the end of that day, your time)
          <input id={f('ends')} type="date" className={o.input} value={ends} onChange={(e) => setEnds(e.target.value)} />
        </label>
        <label className={o.field} htmlFor={f('note')}>
          Note for you (optional), e.g. where you’ll post it
          <input id={f('note')} className={o.input} value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} autoComplete="off" />
        </label>
        <div className={o.jobActions}>
          <Button type="submit" disabled={busy}>
            Make code
          </Button>
        </div>
        {made && (
          <span className={o.card} role="status" aria-label="New claim code">
            <span className={o.itemTitle}>Code ready</span>
            <input className={o.input} readOnly value={showCode(made.code)} aria-label="Claim code" onFocus={(e) => e.currentTarget.select()} />
            <input className={o.input} readOnly value={made.link} aria-label="Claim link" onFocus={(e) => e.currentTarget.select()} />
            <span className={o.jobActions}>
              <Button onClick={() => void copy(showCode(made.code), 'code')}>{copied === 'code' ? 'Copied' : 'Copy code'}</Button>
              <Button onClick={() => void copy(made.link, 'link')}>{copied === 'link' ? 'Copied' : 'Copy link'}</Button>
            </span>
            <span className={o.note}>Copy it now: only a fingerprint of the code is kept, so it can’t be shown again. Lost it? Cancel it and make a new one.</span>
          </span>
        )}
      </form>
    </span>
  );
}
