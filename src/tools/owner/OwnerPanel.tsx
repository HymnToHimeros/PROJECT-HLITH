import type { PanelProps } from '../../core/registry/panels';
import OwnerConsole from './OwnerConsole';

/** The Owner console opened from Account (owners only; the shell checks before showing it). */
export default function OwnerPanel({ games, scope, servers, open, close }: PanelProps) {
  return (
    <OwnerConsole
      games={games}
      scope={scope}
      servers={servers}
      openTab={() => {}}
      open={(m, t) => {
        close();
        open(m, t);
      }}
      openAccount={close}
    />
  );
}
