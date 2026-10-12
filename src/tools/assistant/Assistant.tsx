/**
 * The Assistant (ROADMAP R48): chat with your own Claude key, screenshots,
 * web search, a model picker and the cost of every message. Opens over any
 * screen (PC side panel 420 px, phone sheet, ⌘K / Ctrl+K).
 * Look: docs/design/HLITH App.dc.html (asstOpen, msgs, thinking, suggestions, draft).
 */
import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type DragEvent, type FormEvent } from 'react';
import type { GameContract, GameId } from '../../core/contract';
import { backend } from '../../core/data/backend';
import { ExampleTag, useNow } from '../../core/ui';
import { EditLists } from '../edit-mode/EditMode';
import { AssistantSettingsView } from './AssistantSettings';
import { functionTransport, newChat, send, useChat, type Transport } from './chat';
import { loadLookup, summarize } from './context';
import { prepareImage, isAcceptedImage, type PreparedImage } from './image';
import { FILE_ACCEPT, FILES_MAX, prepareFile, type PreparedFile } from './files';
import { HistoryOffer } from './HistoryOffer';
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
  /** Every registered game, switched on or not (Settings lists the changes made in all of them). Missing = games. */
  allGames?: GameContract[];
  /** How messages travel (tests pass a fake). */
  transport?: Transport;
}

type View = 'chat' | 'settings' | 'lists';

const SUGGESTIONS: Record<'game' | 'all', string[]> = {
  game: ['What should I do tonight?', 'How many pulls can I afford before the next banner?', 'Which events am I behind on?', 'Plan my backlog this week'],
  all: ['Plan my session tonight', 'How much can I still earn this patch?', 'Which events am I behind on?'],
};

export function Assistant({ games, scope, servers, account, allGames, transport = functionTransport }: AssistantProps) {
  const chat = useChat();
  const settings = useSettings();
  const key = useKey();
  const [view, setView] = useState<View>('chat');
  const [draft, setDraft] = useState('');
  const [image, setImage] = useState<PreparedImage | null>(null);
  const [files, setFiles] = useState<PreparedFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [attachError, setAttachError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const game = scope === 'all' ? undefined : games.find((g) => g.id === scope);
  const inView = game ? [game] : games;
  const model = MODELS.find((m) => m.id === settings.model) ?? MODELS[0];
  const now = useNow(60_000);
  const spent = spentToday(settings, now);
  const overLimit = settings.dailyLimit !== null && spent >= settings.dailyLimit;
  // Messages go through HLITH's server function; without a server nothing can be sent (tests bring their own transport).
  const connected = backend !== null || transport !== functionTransport;
  const examplesShown = useExamplesShown();

  // Follow the conversation as it grows (not on open, so the top stays in view).
  useEffect(() => {
    if (chat.items.length > 0) endRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [chat.items.length, chat.thinking]);

  const blocked = !connected
    ? 'Not available in this copy of HLITH (no server).'
    : !key
      ? 'Add your Claude key first (above).'
      : overLimit ? `You reached today’s limit of ${formatUsd(settings.dailyLimit ?? 0)} on this device. Change it in Settings.` : null;

  const submit = async (text: string) => {
    if (blocked || chat.thinking || !key || !model) return;
    const img = image;
    const docs = files;
    setDraft('');
    setImage(null);
    setFiles([]);
    await send({
      text,
      image: img ?? undefined,
      files: docs,
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

  // A screenshot (one per message) or files to read (T71): .json, .md, .txt, .csv, .pdf.
  const attach = async (list: File[]) => {
    const problems: string[] = [];
    let room = FILES_MAX - files.length;
    const added: PreparedFile[] = [];
    for (const file of list) {
      try {
        if (isAcceptedImage(file.type)) {
          setImage(await prepareImage(file));
          continue;
        }
        if (room <= 0) {
          problems.push(`Up to ${FILES_MAX} files per message: “${file.name}” wasn’t added.`);
          continue;
        }
        added.push(await prepareFile(file));
        room--;
      } catch (err) {
        problems.push(err instanceof Error ? err.message : `“${file.name}” can’t be read.`);
      }
    }
    if (added.length) setFiles((cur) => [...cur, ...added].slice(0, FILES_MAX));
    setAttachError(problems.join(' '));
  };
  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const list = [...(e.target.files ?? [])];
    e.target.value = '';
    if (list.length) await attach(list);
  };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (blocked) return;
    const list = [...e.dataTransfer.files];
    if (list.length) void attach(list);
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

      {view === 'settings' && <AssistantSettingsView games={allGames ?? games} />}
      {view === 'lists' && <EditLists games={inView} initialGame={game?.id} />}

      {view === 'chat' && (
        <>
          {/* Without the server no message can be sent, so say that first instead of asking for a paid key that can't be used here. */}
          {!connected && (
            <p className={s.notice} role="note">
              This copy of HLITH isn’t connected to its server, so the Assistant can’t send messages here. You don’t need a Claude key for this copy. Settings and Edit
              lists still work.
            </p>
          )}
          {!key && connected && <KeySetup />}
          {key && connected && !account && (
            <p className={s.notice} role="note">
              Sign in (Account) to send messages: the Assistant runs through HLITH’s server function, which only answers signed-in users.
            </p>
          )}

          <div className={s.messages} aria-live="polite">
            {chat.items.length === 0 ? (
              examplesShown ? (
                <ExampleChat game={game ?? games[0]} />
              ) : (
                <p className={s.hint}>No messages yet. Ask about your pulls, events or what to do tonight; the Assistant answers from your own data.</p>
              )
            ) : (
              chat.items.map((m) =>
                m.role === 'user' ? (
                  <div key={m.id} className={`${s.bubble} ${s.user}`}>
                    {m.image && <img className={s.shot} src={m.image} alt="Your screenshot" />}
                    {m.files && m.files.length > 0 && (
                      <ul className={s.fileChips} aria-label="Files sent">
                        {m.files.map((f, i) => (
                          <li key={`${f.name}-${i}`} className={s.fileChip}>
                            <span className={s.fileKind}>{f.kind === 'pdf' ? 'PDF' : (f.name.split('.').pop() ?? 'TXT').toUpperCase()}</span>
                            {f.name}
                          </li>
                        ))}
                      </ul>
                    )}
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

          <div
            className={s.composer}
            data-dragging={dragging || undefined}
            onDragOver={(e) => {
              if (blocked || !e.dataTransfer.types.includes('Files')) return;
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
            }}
            onDrop={onDrop}
          >
            {dragging && (
              <div className={s.dropHint} aria-hidden="true">
                Drop a screenshot or a .json, .md, .txt, .csv or .pdf file
              </div>
            )}
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
            {files.length > 0 && (
              <ul className={s.pendingFiles} aria-label="Files to send">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className={s.pendingFile}>
                    <span className={s.fileKind}>{f.kind === 'pdf' ? 'PDF' : (f.name.split('.').pop() ?? 'TXT').toUpperCase()}</span>
                    <span className={s.fileName}>{f.name}</span>
                    <span className={s.fileSize}>{f.size < 1024 ? `${f.size} B` : f.size < 1024 * 1024 ? `${Math.round(f.size / 1024)} KB` : `${(f.size / 1024 / 1024).toFixed(1)} MB`}</span>
                    <button type="button" className={s.tool} onClick={() => setFiles((cur) => cur.filter((_, k) => k !== i))} aria-label={`Remove ${f.name}`}>
                      Remove
                    </button>
                    {f.kind === 'text' && /\.json$/i.test(f.name) && <HistoryOffer text={f.data} games={inView} />}
                  </li>
                ))}
              </ul>
            )}
            {attachError && (
              <p className={s.problem} role="alert">
                {attachError}
              </p>
            )}
            <form className={s.composeRow} onSubmit={onSubmit}>
              <input ref={fileRef} className={s.fileInput} type="file" multiple accept={FILE_ACCEPT} tabIndex={-1} aria-hidden="true" onChange={(e) => void onFile(e)} />
              <button type="button" className={s.attach} aria-label="Attach a screenshot or file" title="Attach a screenshot, or a .json, .md, .txt, .csv or .pdf file" onClick={() => fileRef.current?.click()} disabled={!!blocked}>
                ⧉
              </button>
              <input
                className={s.input}
                aria-label="Message to the Assistant"
                placeholder={!connected ? 'Not available here' : blocked && !key ? 'Add your Claude key to start' : 'Ask about pulls, builds, farming…'}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={!!blocked}
              />
              <button type="submit" className={s.send} disabled={!!blocked || chat.thinking || (!draft.trim() && !image && files.length === 0)}>
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
