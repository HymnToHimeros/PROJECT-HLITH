/**
 * The Assistant (ROADMAP R48): chat with your own Claude key, screenshots,
 * web search, a model picker and the cost of every message. Opens over any
 * screen (PC side panel 420 px, phone sheet, ⌘K / Ctrl+K).
 * Look: docs/design/HLITH App.dc.html (asstOpen, msgs, thinking, suggestions, draft).
 */
import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type FormEvent } from 'react';
import type { GameContract, GameId } from '../../core/contract';
import { backend } from '../../core/data/backend';
import { ExampleTag, useNow } from '../../core/ui';
import { EditLists } from '../edit-mode/EditMode';
import { AssistantSettingsView } from './AssistantSettings';
import { functionTransport, newChat, send, useChat, type Transport } from './chat';
import { loadLookup, summarize } from './context';
import { prepareImage, type PreparedImage } from './image';
import { useKey } from './keyStore';
import { KeySetup } from './KeySetup';
import { formatUsd, MODELS, type Cost } from './models';
import { ProposalCard, ProposalsHowTo } from './Proposals';
import type { Proposal } from './proposals';
import { recordSpend, spentToday, useSettings } from './settings';
import s from './assistant.module.css';
import { useExamplesShown } from '../../core/data/prefs';

export interface AssistantProps {
  games: GameContract[];
  scope: GameId | 'all';
  servers: Record<GameId, string>;
  account: { email: string } | null;
  /** How messages travel (tests pass a fake). */
  transport?: Transport;
}

type View = 'chat' | 'settings' | 'lists';

const SUGGESTIONS: Record<'game' | 'all', string[]> = {
  game: ['What should I do tonight?', 'How many pulls can I afford before the next banner?', 'Which events am I behind on?', 'Plan my backlog this week'],
  all: ['Plan my session tonight', 'How much can I still earn this patch?', 'Which events am I behind on?'],
};

export function Assistant({ games, scope, servers, account, transport = functionTransport }: AssistantProps) {
  const chat = useChat();
  const settings = useSettings();
  const key = useKey();
  const [view, setView] = useState<View>('chat');
  const [draft, setDraft] = useState('');
  const [image, setImage] = useState<PreparedImage | null>(null);
  const [attachError, setAttachError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const game = scope === 'all' ? undefined : games.find((g) => g.id === scope);
  const inView = game ? [game] : games;
  const model = MODELS.find((m) => m.id === settings.model) ?? MODELS[0];
  const now = useNow(60_000);
  const spent = spentToday(settings, now);
  const overLimit = settings.dailyLimit !== null && spent >= settings.dailyLimit;
  const connected = backend !== null;

  // Follow the conversation as it grows (not on open, so the top stays in view).
  useEffect(() => {
    if (chat.items.length > 0) endRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [chat.items.length, chat.thinking]);

  const blocked = !key ? 'Add your Claude key first (above).' : overLimit ? `You reached today’s limit of ${formatUsd(settings.dailyLimit ?? 0)} on this device. Change it in Settings.` : null;

  const submit = async (text: string) => {
    if (blocked || chat.thinking || !key || !model) return;
    const img = image;
    setDraft('');
    setImage(null);
    await send({
      text,
      image: img ?? undefined,
      apiKey: key.key,
      model: model.id,
      webSearch: settings.webSearch && model.webSearch,
      prepare: async () => {
        const lookup = await loadLookup(inView, servers, Date.now());
        return { context: summarize(lookup, Date.now()), lookup };
      },
      transport,
      onCost: (m, cost) => recordSpend(m, cost.usd, Date.now()),
    });
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setImage(await prepareImage(file));
      setAttachError('');
    } catch (err) {
      setAttachError(err instanceof Error ? err.message : 'That file can’t be read.');
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void submit(draft);
  };

  const ventStyle = game ? ({ '--vent': game.vent } as CSSProperties) : undefined;

  return (
    <div className={s.panel} style={ventStyle}>
      <div className={s.head}>
        <span className={s.mark} aria-hidden="true" />
        <div className={s.headText}>
          <span className={s.headLabel}>{game ? game.short : 'ALL GAMES'}</span>
          <span className={s.headSub}>Sees {game ? game.name : 'all your games'} · answers from your data</span>
        </div>
        <span className={s.spend} title="Estimated, counted on this device">
          Today {formatUsd(spent)}
          {settings.dailyLimit !== null && <> of {formatUsd(settings.dailyLimit)}</>}
        </span>
      </div>

      <div className={s.tools} role="group" aria-label="Assistant">
        <button type="button" className={s.tool} aria-pressed={view === 'chat'} onClick={() => setView('chat')}>
          Chat
        </button>
        <button type="button" className={s.tool} onClick={() => (newChat(), setView('chat'))} disabled={chat.items.length === 0 && view === 'chat'}>
          New chat
        </button>
        <button type="button" className={s.tool} aria-pressed={view === 'settings'} onClick={() => setView('settings')}>
          Settings
        </button>
        <button type="button" className={s.tool} aria-pressed={view === 'lists'} onClick={() => setView('lists')}>
          Edit lists
        </button>
      </div>

      {view === 'settings' && <AssistantSettingsView games={inView} />}
      {view === 'lists' && <EditLists games={inView} initialGame={game?.id} />}

      {view === 'chat' && (
        <>
          {!key && <KeySetup />}
          {key && !connected && (
            <p className={s.notice} role="note">
              This copy of HLITH isn’t connected to its server, so the Assistant can’t send messages here. Everything else on this panel works.
            </p>
          )}
          {key && connected && !account && (
            <p className={s.notice} role="note">
              Sign in (Account) to send messages: the Assistant runs through HLITH’s server function, which only answers signed-in users.
            </p>
          )}

          <div className={s.messages} aria-live="polite">
            {chat.items.length === 0 ? (
              <ExampleChat game={game ?? games[0]} />
            ) : (
              chat.items.map((m) =>
                m.role === 'user' ? (
                  <div key={m.id} className={`${s.bubble} ${s.user}`}>
                    {m.image && <img className={s.shot} src={m.image} alt="Your screenshot" />}
                    {m.text}
                  </div>
                ) : m.role === 'assistant' ? (
                  <div key={m.id} className={s.turn}>
                    {m.searches && m.searches.length > 0 && <span className={s.meta}>Searched the web: {m.searches.map((q) => `“${q}”`).join(', ')}</span>}
                    {m.text && <div className={`${s.bubble} ${s.assistant}`}>{m.text}</div>}
                    {m.proposals?.map((id) => {
                      const p = chat.proposals[id];
                      return p ? <ProposalCard key={id} proposal={p.proposal} status={p.status} error={p.error} game={games.find((g) => g.id === p.proposal.game)} showGame={!game} /> : null;
                    })}
                    {m.sources && m.sources.length > 0 && (
                      <ol className={s.sources} aria-label="Sources">
                        {m.sources.map((src) => (
                          <li key={src.url}>
                            <a className={s.textLink} href={src.url} target="_blank" rel="noreferrer">
                              {src.title || src.url}
                            </a>
                          </li>
                        ))}
                      </ol>
                    )}
                    {m.cost && <CostLine model={m.model} cost={m.cost} />}
                  </div>
                ) : (
                  <p key={m.id} className={m.role === 'error' ? s.error : s.notice} role={m.role === 'error' ? 'alert' : 'note'}>
                    {m.text}
                  </p>
                ),
              )
            )}
            {chat.thinking && (
              <div className={s.thinking} role="status" aria-label="The Assistant is thinking">
                ···
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className={s.composer}>
            {/* Scrolls sideways on narrow screens; focusable so keyboards can scroll it too. */}
            <div className={s.suggestions} role="group" aria-label="Suggested questions" tabIndex={0}>
              {SUGGESTIONS[game ? 'game' : 'all'].map((q) => (
                <button key={q} type="button" className={s.suggestion} disabled={!!blocked || chat.thinking} onClick={() => void submit(q)}>
                  {q}
                </button>
              ))}
            </div>
            {image && (
              <div className={s.pending}>
                <img src={image.preview} alt="Screenshot to send" />
                <span>Screenshot attached (shrunk to save tokens).</span>
                <button type="button" className={s.tool} onClick={() => setImage(null)}>
                  Remove
                </button>
              </div>
            )}
            {attachError && (
              <p className={s.problem} role="alert">
                {attachError}
              </p>
            )}
            <form className={s.composeRow} onSubmit={onSubmit}>
              <input ref={fileRef} className={s.fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" tabIndex={-1} aria-hidden="true" onChange={(e) => void onFile(e)} />
              <button type="button" className={s.attach} aria-label="Attach a screenshot" title="Attach a screenshot" onClick={() => fileRef.current?.click()} disabled={!!blocked}>
                ⧉
              </button>
              <input
                className={s.input}
                aria-label="Message to the Assistant"
                placeholder={blocked && !key ? 'Add your Claude key to start' : 'Ask about pulls, builds, farming…'}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={!!blocked}
              />
              <button type="submit" className={s.send} disabled={!!blocked || chat.thinking || (!draft.trim() && !image)}>
                Send
              </button>
            </form>
            <p className={s.hint}>
              {blocked ??
                `${model?.label ?? ''}${settings.webSearch && model?.webSearch ? ' · web search on' : ''} · each reply shows its cost (estimate)`}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function CostLine({ model, cost }: { model: string | undefined; cost: Cost }) {
  const label = MODELS.find((m) => m.id === model)?.label ?? model ?? '';
  return (
    <span className={s.meta}>
      {label} · {cost.usd === null ? 'cost unknown (no price for a model that took part)' : `≈ ${formatUsd(cost.usd)}`} · {cost.inputTokens.toLocaleString()} in / {cost.outputTokens.toLocaleString()} out
      {cost.searches ? ` · ${cost.searches} search${cost.searches === 1 ? '' : 'es'}` : ''}
      {cost.fellBack ? ' · answered by a fallback model' : ''} · estimate
    </span>
  );
}

/** Shown while the chat is empty: what a chat looks like. Clearly an example; its buttons do nothing. */
function ExampleChat({ game }: { game: GameContract | undefined }) {
  const shown = useExamplesShown();
  const currency = game?.currencies.find((c) => c.perPull) ?? game?.currencies[0];
  const proposals: Proposal[] = game
    ? [
        {
          id: 'example-1',
          tool: 'log_bank_balance',
          kind: 'bank',
          game: game.id,
          title: `You have 14,280 ${currency?.name ?? 'premium currency'}`,
          detail: 'From your screenshot',
          why: 'Your bank log is a week old; this updates what Pulls can count on.',
          input: {},
          problem: null,
        },
        {
          id: 'example-2',
          tool: 'propose_plan',
          kind: 'plan',
          game: game.id,
          title: 'Farm ascension materials during the double-drop event',
          detail: 'Mon 12 Oct → Wed 21 Oct',
          why: 'Double drops end the day the banner you want opens.',
          input: {},
          problem: null,
        },
      ]
    : [];
  if (!shown) return null; // Account → Example data: off
  return (
    <section className={s.example} aria-label="Example conversation">
      <div className={s.exampleHead}>
        <ExampleTag />
        <span>An example of how a chat looks. Not your data; these buttons do nothing.</span>
      </div>
      <div className={`${s.bubble} ${s.user}`}>Here’s my currency screen. Anything I should plan this week?</div>
      <div className={`${s.bubble} ${s.assistant}`}>
        I read {currency ? `14,280 ${currency.name}` : 'your balance'} from the screenshot. Two suggestions, for you to approve or dismiss:
      </div>
      {proposals.map((p) => (
        <ProposalCard key={p.id} proposal={p} status="pending" game={game} example />
      ))}
      <span className={s.meta}>Claude Sonnet 5.5 · ≈ $0.006 · 2,410 in / 180 out · estimate</span>
      <ProposalsHowTo />
    </section>
  );
}
