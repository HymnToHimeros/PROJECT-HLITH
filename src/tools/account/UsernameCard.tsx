import { useState } from 'react';
import { UsernameForm } from '../../core/auth/FirstRun';
import { serverGate, setGate, type Gate, type GateApi } from '../../core/auth/gate';
import { formatDate } from '../../core/time/reset';
import { Button, useNow } from '../../core/ui';
import p from './profile.module.css';

/**
 * Account → Profile → Username (T62): the name you show up as. Changing it is checked on the
 * server (unique, allowed, at most once every 30 days; the first change after choosing is free);
 * the old name is freed for others.
 */
export function UsernameCard({ gate, api = serverGate }: { gate: Gate; api?: GateApi | null }) {
  const now = useNow(60_000);
  const [editing, setEditing] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const waiting = gate.nextChangeAt !== null && gate.nextChangeAt > now;
  return (
    <section className={p.editCard} aria-labelledby="username-title">
      <h3 className={p.cardTitle} id="username-title">
        Username
      </h3>
      {editing && api ? (
        <UsernameForm
          api={api}
          initial={gate.username ?? ''}
          current={gate.username}
          submitLabel="Save username"
          onCancel={() => setEditing(false)}
          onSaved={(next) => {
            setGate(next);
            setEditing(false);
            setSaid(`Your username is now @${next.username ?? ''}.`);
          }}
        />
      ) : (
        <>
          <p className={p.text}>
            <strong>@{gate.username}</strong> is how you show up on your profile card, in the community and to the owner.
          </p>
          {said && (
            <p className={p.muted} role="status">
              {said}
            </p>
          )}
          {waiting ? (
            <p className={p.muted}>You can change it again on {formatDate(gate.nextChangeAt as number)} (once every 30 days).</p>
          ) : (
            <div className={p.actions}>
              <Button onClick={() => setEditing(true)} disabled={!api}>
                Change username
              </Button>
              <span className={p.muted}>Once every 30 days. Your old name becomes free for others.</span>
            </div>
          )}
        </>
      )}
    </section>
  );
}
