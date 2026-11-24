import {
  Check,
  Copy,
  Edit3,
  ExternalLink,
  FileText,
  Home,
  Image as ImageIcon,
  Loader2,
  MessageSquarePlus,
  Microscope,
  Pencil,
  RotateCcw,
  Search,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  AppWorkspace,
  Attachment,
  ChatMessage,
  Conversation,
  LabSettings,
  TokenUsageStats,
} from '../types/app';
import { estimateConversationTokens, MODEL_CATALOG } from '../utils/labLogic';
import { ComposerInput } from './ComposerInput';
import { MarkdownRenderer } from './MarkdownRenderer';

interface ChatWorkspaceProps {
  conversations: Conversation[];
  activeConversation: Conversation | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, title: string) => void;
  onNavigateWorkspace: (workspace: AppWorkspace) => void;
  composerValue: string;
  onComposerChange: (value: string) => void;
  attachments: Attachment[];
  onAddAttachments: (files: Attachment[]) => void;
  onRemoveAttachment: (id: string) => void;
  settings: LabSettings;
  onToggleWebSearch: () => void;
  onSendMessage: () => void;
  onStopStreaming: () => void;
  onRegenerateMessage: (assistantMsgId: string) => void;
  onRetryWithoutWebSearch?: (assistantMsgId: string) => void;
  onEditUserMessage: (userMsgId: string, newContent: string) => void;
  onQuickFollowUp: (prompt: string) => void;
  onPlayUiClick: () => void;
  isStreaming: boolean;
  tokenStats: TokenUsageStats;
  mobileSidebarOpen: boolean;
  onCloseMobileSidebar: () => void;
}

export function ChatWorkspace({
  conversations,
  activeConversation,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onRenameConversation,
  onNavigateWorkspace,
  composerValue,
  onComposerChange,
  attachments,
  onAddAttachments,
  onRemoveAttachment,
  settings,
  onToggleWebSearch,
  onSendMessage,
  onStopStreaming,
  onRegenerateMessage,
  onRetryWithoutWebSearch,
  onEditUserMessage,
  onQuickFollowUp,
  onPlayUiClick,
  isStreaming,
  tokenStats,
  mobileSidebarOpen,
  onCloseMobileSidebar,
}: ChatWorkspaceProps) {
  const [historyFilter, setHistoryFilter] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState('');
  const [renamingConvId, setRenamingConvId] = useState<string | null>(null);
  const [renamingDraft, setRenamingDraft] = useState('');

  const [ttsLoadingId, setTtsLoadingId] = useState<string | null>(null);
  const [ttsPlayingId, setTtsPlayingId] = useState<string | null>(null);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const threadEndRef = useRef<HTMLDivElement | null>(null);

  const messages = activeConversation?.messages ?? [];

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: settings.reducedMotion ? 'auto' : 'smooth' });
  }, [messages.length, messages[messages.length - 1]?.content, settings.reducedMotion]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const filteredConversations = useMemo(() => {
    const q = historyFilter.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.messages.some((m) => m.content.toLowerCase().includes(q))
    );
  }, [conversations, historyFilter]);

  const contextTokens = useMemo(
    () => estimateConversationTokens(activeConversation),
    [activeConversation]
  );
  const contextLimit = MODEL_CATALOG[settings.model].contextWindow;

  const handleCopyMessage = async (msg: ChatMessage) => {
    await navigator.clipboard.writeText(msg.content);
    setCopiedId(msg.id);
    window.setTimeout(() => setCopiedId((curr) => (curr === msg.id ? null : curr)), 1800);
  };

  const handleToggleTts = async (msg: ChatMessage) => {
    setTtsError(null);
    if (ttsPlayingId === msg.id && audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setTtsPlayingId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setTtsPlayingId(null);
    }

    setTtsLoadingId(msg.id);
    try {
      const resp = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: msg.content, voiceName: settings.ttsVoice }),
      });
      const data = (await resp.json()) as {
        audioBase64?: string;
        mimeType?: string;
        error?: string;
      };
      if (!resp.ok || !data.audioBase64) {
        throw new Error(data.error || 'Voice playback failed.');
      }

      const audio = new Audio(`data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`);
      audioRef.current = audio;
      audio.onended = () => {
        setTtsPlayingId(null);
        audioRef.current = null;
      };
      audio.onerror = () => {
        setTtsPlayingId(null);
        setTtsError('Unable to play synthesized audio.');
      };
      await audio.play();
      setTtsPlayingId(msg.id);
    } catch (err) {
      setTtsError(err instanceof Error ? err.message : 'TTS playback unavailable.');
    } finally {
      setTtsLoadingId(null);
    }
  };

  const sidebarContent = (
    <div className="flex h-full flex-col bg-[#0A0809]/95">
      <div className="border-b border-white/10 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-hawkins-display text-sm font-bold tracking-[0.12em] text-white">
              HAWKINS AI
            </div>
            <div className="font-hawkins-mono text-[10px] tracking-[0.18em] text-[#FF5C66] uppercase">
              TERMINAL ARCHIVE
            </div>
          </div>
          <button
            type="button"
            onClick={onCloseMobileSidebar}
            aria-label="Close sidebar"
            className="rounded p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            onNewConversation();
            onCloseMobileSidebar();
          }}
          className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#E50914] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#FF1A26]"
        >
          <MessageSquarePlus className="h-4 w-4" />
          <span>New Transmission</span>
        </button>

        <div className="mt-2 grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={() => {
              onNavigateWorkspace('home');
              onCloseMobileSidebar();
            }}
            className="flex items-center justify-center gap-1 rounded border border-white/10 bg-[#140D10] py-1.5 text-[11px] text-zinc-300 hover:border-white/25 hover:text-white"
          >
            <Home className="h-3 w-3" />
            <span>Home</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onNavigateWorkspace('research');
              onCloseMobileSidebar();
            }}
            className="flex items-center justify-center gap-1 rounded border border-white/10 bg-[#140D10] py-1.5 text-[11px] text-zinc-300 hover:border-white/25 hover:text-white"
          >
            <Microscope className="h-3 w-3" />
            <span>Research</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onNavigateWorkspace('visual');
              onCloseMobileSidebar();
            }}
            className="flex items-center justify-center gap-1 rounded border border-white/10 bg-[#140D10] py-1.5 text-[11px] text-zinc-300 hover:border-white/25 hover:text-white"
          >
            <ImageIcon className="h-3 w-3" />
            <span>Visuals</span>
          </button>
        </div>
      </div>

      {/* History Search */}
      <div className="border-b border-white/8 px-3 py-2.5">
        <label htmlFor="sidebar-history-search" className="sr-only">
          Search conversations
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500"
            aria-hidden="true"
          />
          <input
            id="sidebar-history-search"
            type="text"
            value={historyFilter}
            onChange={(e) => setHistoryFilter(e.target.value)}
            placeholder="Filter logs..."
            className="h-8 w-full rounded-md border border-white/10 bg-[#120D10] pr-3 pl-8 text-xs text-zinc-200 placeholder:text-zinc-500 focus:border-[#E50914] focus:outline-none"
          />
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto p-2.5">
        {filteredConversations.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-zinc-500">
            No matching transmissions found.
          </p>
        ) : (
          <ul className="space-y-1">
            {filteredConversations.map((conv) => {
              const isActive = conv.id === activeConversation?.id;
              const isRenaming = renamingConvId === conv.id;

              return (
                <li
                  key={conv.id}
                  className={`group rounded-lg border transition-colors ${
                    isActive
                      ? 'border-[#E50914]/55 bg-[#240A0D]/80'
                      : 'border-transparent hover:border-white/10 hover:bg-white/[0.03]'
                  }`}
                >
                  {isRenaming ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (renamingDraft.trim()) {
                          onRenameConversation(conv.id, renamingDraft.trim());
                        }
                        setRenamingConvId(null);
                      }}
                      className="flex items-center gap-1 p-1.5"
                    >
                      <input
                        type="text"
                        autoFocus
                        value={renamingDraft}
                        onChange={(e) => setRenamingDraft(e.target.value)}
                        onBlur={() => setRenamingConvId(null)}
                        className="h-7 flex-1 rounded border border-[#E50914]/50 bg-[#08080A] px-2 text-xs text-white focus:outline-none"
                      />
                    </form>
                  ) : (
                    <div className="flex items-center gap-1 px-2.5 py-2">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectConversation(conv.id);
                          onCloseMobileSidebar();
                        }}
                        className="min-w-0 flex-1 text-left focus:outline-none"
                      >
                        <div className="truncate text-xs font-medium text-zinc-100">
                          {conv.title}
                        </div>
                        <div className="font-hawkins-mono mt-0.5 text-[10px] text-zinc-500">
                          {conv.messages.length} msgs ·{' '}
                          {new Date(conv.updatedAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </button>

                      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => {
                            setRenamingConvId(conv.id);
                            setRenamingDraft(conv.title);
                          }}
                          aria-label={`Rename ${conv.title}`}
                          className="rounded p-1 text-zinc-400 hover:bg-white/10 hover:text-white"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteConversation(conv.id)}
                          aria-label={`Delete ${conv.title}`}
                          className="rounded p-1 text-zinc-400 hover:bg-[#E50914]/20 hover:text-[#FF6B73]"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Session Token Footer */}
      <div className="border-t border-white/10 bg-[#080708] p-3.5 text-xs">
        <div className="flex items-center justify-between text-zinc-400">
          <span>Context Est.</span>
          <span className="font-hawkins-mono text-zinc-200">
            {contextTokens.toLocaleString()} / {(contextLimit / 1024).toFixed(0)}k
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between text-zinc-500">
          <span>Session Total</span>
          <span className="font-hawkins-mono text-zinc-300">
            {tokenStats.totalTokens.toLocaleString()} tok
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative z-10 flex min-h-0 flex-1 overflow-hidden">
      {/* Desktop Left Sidebar */}
      <aside className="hidden w-72 shrink-0 border-r border-white/10 lg:block">
        {sidebarContent}
      </aside>

      {/* Mobile Slide-Over Sidebar */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/85"
            onClick={onCloseMobileSidebar}
            aria-hidden="true"
          />
          <aside className="relative z-10 h-full w-72 border-r border-white/15">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Chat Canvas */}
      <main className="flex min-w-0 flex-1 flex-col">
        {/* Thread Scroll Area */}
        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
            {messages.length === 0 ? (
              <div className="my-12 rounded-xl border border-white/10 bg-[#0E0A0C]/85 p-8 text-center">
                <h1 className="font-hawkins-display st-title-glow-subtle text-2xl font-bold">
                  Hawkins Neural Channel Open
                </h1>
                <p className="mx-auto mt-2 max-w-md text-sm text-zinc-400">
                  Begin typing below, attach a document or image, or enable Google Search grounding
                  for live web verification.
                </p>
              </div>
            ) : (
              messages.map((msg, idx) => {
                const isUser = msg.role === 'user';
                const isLastAssistant = !isUser && idx === messages.length - 1;
                const isEditing = editingMsgId === msg.id;

                return (
                  <article
                    key={msg.id}
                    aria-label={isUser ? 'User message' : 'Hawkins AI response'}
                    className={`rounded-xl border p-4 sm:p-5 ${
                      isUser
                        ? 'border-white/10 bg-[#121013]/90'
                        : 'border-[#E50914]/30 bg-[#13090C]/90 shadow-[0_0_24px_rgba(229,9,20,0.06)]'
                    }`}
                  >
                    {/* Message Header */}
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-white/8 pb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-hawkins-mono text-xs font-semibold tracking-wider uppercase ${
                            isUser ? 'text-zinc-300' : 'text-[#FF5C66]'
                          }`}
                        >
                          {isUser ? 'Subject // You' : 'Hawkins Lab AI'}
                        </span>
                        {msg.model && !isUser && (
                          <span className="font-hawkins-mono text-[11px] text-zinc-500">
                            · {MODEL_CATALOG[msg.model]?.shortLabel ?? msg.model}
                          </span>
                        )}
                      </div>

                      <span className="font-hawkins-mono text-[11px] text-zinc-500">
                        {new Date(msg.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                    </div>

                    {/* Attachments */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="mb-3 flex flex-wrap gap-2">
                        {msg.attachments.map((att) => (
                          <div
                            key={att.id}
                            className="flex items-center gap-2 rounded-md border border-white/10 bg-[#1A1013] px-2.5 py-1.5 text-xs text-zinc-300"
                          >
                            {att.mimeType.startsWith('image/') && att.dataBase64 ? (
                              <img
                                src={`data:${att.mimeType};base64,${att.dataBase64}`}
                                alt={att.name}
                                className="h-12 w-12 rounded object-cover"
                              />
                            ) : (
                              <FileText className="h-4 w-4 text-[#FF5C66]" />
                            )}
                            <span className="max-w-[200px] truncate">{att.name}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Content or Inline Edit */}
                    {isEditing ? (
                      <div className="space-y-2.5">
                        <textarea
                          rows={3}
                          value={editingDraft}
                          onChange={(e) => setEditingDraft(e.target.value)}
                          className="w-full rounded-lg border border-[#E50914]/50 bg-[#08080A] p-3 text-sm text-zinc-100 focus:outline-none"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingMsgId(null)}
                            className="rounded-md border border-white/15 px-3 py-1.5 text-xs text-zinc-300 hover:text-white"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (editingDraft.trim()) {
                                onEditUserMessage(msg.id, editingDraft.trim());
                              }
                              setEditingMsgId(null);
                            }}
                            className="rounded-md bg-[#E50914] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#FF1A26]"
                          >
                            Save & Resubmit
                          </button>
                        </div>
                      </div>
                    ) : msg.error ? (
                      <div
                        role="alert"
                        className="space-y-2.5 rounded-lg border border-[#E50914]/50 bg-[#240A0D] p-3 text-sm text-[#FF9CA2]"
                      >
                        <p>{msg.error}</p>
                        {settings.webSearch && onRetryWithoutWebSearch && !isStreaming && (
                          <button
                            type="button"
                            onClick={() => onRetryWithoutWebSearch(msg.id)}
                            className="font-hawkins-mono inline-flex items-center rounded border border-[#E50914]/60 bg-[#3A1016] px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-[#E50914]"
                          >
                            Retry without Web Search
                          </button>
                        )}
                      </div>
                    ) : isUser ? (
                      <p className="text-[15px] leading-7 whitespace-pre-wrap text-zinc-100">
                        {msg.content}
                      </p>
                    ) : msg.content ? (
                      <MarkdownRenderer content={msg.content} />
                    ) : isStreaming && isLastAssistant ? (
                      <div className="flex items-center gap-2 py-2 text-sm text-zinc-400">
                        <Loader2 className="h-4 w-4 animate-spin text-[#E50914]" />
                        <span>Receiving signal from Hawkins Terminal...</span>
                      </div>
                    ) : null}

                    {/* Grounded Citations */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-4 border-t border-white/10 pt-3">
                        <div className="font-hawkins-mono mb-2 text-[11px] tracking-wider text-zinc-400 uppercase">
                          Verified Web Sources ({msg.sources.length})
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {msg.sources.map((src, sIdx) => (
                            <a
                              key={src.url}
                              href={src.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex max-w-xs items-center gap-1.5 rounded-md border border-white/10 bg-[#1B0E12] px-2.5 py-1 text-xs text-zinc-300 transition-colors hover:border-[#E50914]/60 hover:text-white"
                            >
                              <span className="font-hawkins-mono text-[#FF5C66]">[{sIdx + 1}]</span>
                              <span className="truncate">{src.title}</span>
                              <ExternalLink className="h-3 w-3 shrink-0 text-zinc-500" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Message Controls */}
                    {!isEditing && (msg.content || msg.error) && (
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/6 pt-2.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleCopyMessage(msg)}
                            aria-label="Copy message"
                            className="inline-flex h-7 items-center gap-1.5 rounded border border-white/10 bg-[#160F12] px-2.5 text-[11px] text-zinc-300 transition-colors hover:border-white/25 hover:text-white"
                          >
                            {copiedId === msg.id ? (
                              <>
                                <Check className="h-3 w-3 text-emerald-400" />
                                <span>Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>

                          {isUser && !isStreaming && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingMsgId(msg.id);
                                setEditingDraft(msg.content);
                              }}
                              aria-label="Edit message"
                              className="inline-flex h-7 items-center gap-1.5 rounded border border-white/10 bg-[#160F12] px-2.5 text-[11px] text-zinc-300 transition-colors hover:border-white/25 hover:text-white"
                            >
                              <Edit3 className="h-3 w-3" />
                              <span>Edit</span>
                            </button>
                          )}

                          {!isUser && !isStreaming && (
                            <>
                              <button
                                type="button"
                                onClick={() => onRegenerateMessage(msg.id)}
                                aria-label="Regenerate response"
                                className="inline-flex h-7 items-center gap-1.5 rounded border border-white/10 bg-[#160F12] px-2.5 text-[11px] text-zinc-300 transition-colors hover:border-white/25 hover:text-white"
                              >
                                <RotateCcw className="h-3 w-3" />
                                <span>Regenerate</span>
                              </button>

                              {msg.content && (
                                <button
                                  type="button"
                                  onClick={() => handleToggleTts(msg)}
                                  disabled={ttsLoadingId === msg.id}
                                  aria-label={
                                    ttsPlayingId === msg.id ? 'Stop voice playback' : 'Listen'
                                  }
                                  className="inline-flex h-7 items-center gap-1.5 rounded border border-white/10 bg-[#160F12] px-2.5 text-[11px] text-zinc-300 transition-colors hover:border-white/25 hover:text-white"
                                >
                                  {ttsLoadingId === msg.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : ttsPlayingId === msg.id ? (
                                    <VolumeX className="h-3 w-3 text-[#FF5C66]" />
                                  ) : (
                                    <Volume2 className="h-3 w-3" />
                                  )}
                                  <span>{ttsPlayingId === msg.id ? 'Stop Audio' : 'Listen'}</span>
                                </button>
                              )}
                            </>
                          )}
                        </div>

                        {msg.usage && (
                          <span className="font-hawkins-mono text-[11px] text-zinc-500">
                            {msg.usage.totalTokens.toLocaleString()} tokens
                          </span>
                        )}
                      </div>
                    )}

                    {/* Interactive Follow-Up Prompts on latest completed AI response */}
                    {isLastAssistant && !isStreaming && msg.content && !msg.error && (
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        {[
                          { label: 'Dig deeper', prompt: 'Elaborate further on the key technical details above.' },
                          { label: 'Summarize concisely', prompt: 'Summarize the response above in 3 crisp bullet points.' },
                          { label: 'Give a code example', prompt: 'Provide a practical TypeScript or Python code example illustrating this.' },
                        ].map((chip) => (
                          <button
                            key={chip.label}
                            type="button"
                            onClick={() => {
                              onPlayUiClick();
                              onQuickFollowUp(chip.prompt);
                            }}
                            className="font-hawkins-mono rounded-md border border-white/10 bg-[#190F12] px-2.5 py-1 text-[11px] text-zinc-300 transition-colors hover:border-[#E50914]/60 hover:text-white"
                          >
                            {chip.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })
            )}
            {ttsError && (
              <p className="text-center text-xs text-amber-400" role="status">
                {ttsError}
              </p>
            )}
            <div ref={threadEndRef} />
          </div>
        </div>

        {/* Sticky Bottom Composer */}
        <div className="border-t border-white/10 bg-[#080808]/95 px-4 py-3 sm:px-8">
          <div className="mx-auto max-w-4xl">
            <ComposerInput
              variant="chat"
              value={composerValue}
              onChange={onComposerChange}
              attachments={attachments}
              onAddAttachments={onAddAttachments}
              onRemoveAttachment={onRemoveAttachment}
              webSearch={settings.webSearch}
              onToggleWebSearch={onToggleWebSearch}
              onSubmit={onSendMessage}
              onStop={onStopStreaming}
              isStreaming={isStreaming}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
