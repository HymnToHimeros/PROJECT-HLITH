import type { PanelProps } from '../../core/registry/panels';
import { Assistant } from './Assistant';

/** The 'assistant' side panel the shell opens (registered in src/main.tsx). */
export default function AssistantPanel({ games, scope, servers, account }: PanelProps) {
  return <Assistant games={games} scope={scope} servers={servers} account={account} />;
}
