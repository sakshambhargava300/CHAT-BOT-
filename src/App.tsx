import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AtmosphericBackground } from './components/AtmosphericBackground';
import { ChatWorkspace } from './components/ChatWorkspace';
import { DeepResearchWorkspace } from './components/DeepResearchWorkspace';
import { HomepageHero, type QuickActionType } from './components/HomepageHero';
import { SettingsModal } from './components/SettingsModal';
import { TopHeader } from './components/TopHeader';
import { VisualLabWorkspace } from './components/VisualLabWorkspace';
import type {
  AppWorkspace,
  Attachment,
  ChatMessage,
  Conversation,
  GroundingSource,
  LabSettings,
  PersonaPreset,
  ServerHealthStatus,
  TokenUsageStats,
  VisualAssetResult,
} from './types/app';
import {
  accumulateTokenUsage,
  buildSystemInstruction,
  createConversationTitle,
  DEFAULT_TOKEN_STATS,
  estimateConversationTokens,
  estimateTokenCount,
  parseSseLine,
  sanitizeLabSettings,
} from './utils/labLogic';
import { UpsideDownSoundscape } from './utils/upsideDownAudio';

const STORAGE_CONVERSATIONS_KEY = 'st_ai_conversations_v1';
const STORAGE_SETTINGS_KEY = 'st_ai_settings_v1';
const STORAGE_STATS_KEY = 'st_ai_token_stats_v1';

function loadStoredJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function getInitialWorkspace(): AppWorkspace {
  if (typeof window === 'undefined') return 'home';
  const params = new URLSearchParams(window.location.search);
  if (params.get('autostart') === '1') return 'chat';
  const ws = params.get('workspace');
  if (ws === 'chat' || ws === 'research' || ws === 'visual') return ws;
  return 'home';
}

export default function App() {
  const [workspace, setWorkspace] = useState<AppWorkspace>(getInitialWorkspace);
  const [conversations, setConversations] = useState<Conversation[]>(() =>
    loadStoredJson<Conversation[]>(STORAGE_CONVERSATIONS_KEY, [])
  );
  const [activeConversationId, setActiveConversationId] = useState<string | null>(() => {
    const stored = loadStoredJson<Conversation[]>(STORAGE_CONVERSATIONS_KEY, []);
    return stored[0]?.id ?? null;
  });

  const [settings, setSettings] = useState<LabSettings>(() =>
    sanitizeLabSettings(loadStoredJson<Partial<LabSettings>>(STORAGE_SETTINGS_KEY, {}))
  );
  const [tokenStats, setTokenStats] = useState<TokenUsageStats>(() =>
    loadStoredJson<TokenUsageStats>(STORAGE_STATS_KEY, DEFAULT_TOKEN_STATS)
  );

  const [promptInput, setPromptInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [health, setHealth] = useState<ServerHealthStatus>({
    ok: true,
    apiKeyConfigured: true,
    provider: 'Google Gemini (Hawkins Lab Proxy)',
    endpoint: '/api/chat',
    checkedAt: Date.now(),
  });

  const chatAbortRef = useRef<AbortController | null>(null);
  const soundscapeRef = useRef<UpsideDownSoundscape | null>(null);

  useEffect(() => {
    const engine = new UpsideDownSoundscape();
    soundscapeRef.current = engine;

    const handleFirstGesture = () => {
      void engine.unlockAndSync(
        settings.ambientSoundMuted,
        settings.ambientVolume,
        settings.uiSoundsEnabled,
        settings.dimensionMode,
        settings.nostalgiaSynthEnabled
      );
    };

    window.addEventListener('pointerdown', handleFirstGesture, { once: true });
    window.addEventListener('keydown', handleFirstGesture, { once: true });

    return () => {
      window.removeEventListener('pointerdown', handleFirstGesture);
      window.removeEventListener('keydown', handleFirstGesture);
      engine.dispose();
      soundscapeRef.current = null;
    };
    // Initialize soundscape controller once on mount; settings sync runs in effect below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    soundscapeRef.current?.updateSettings(
      settings.ambientSoundMuted,
      settings.ambientVolume,
      settings.uiSoundsEnabled,
      settings.dimensionMode,
      settings.nostalgiaSynthEnabled
    );
  }, [
    settings.ambientSoundMuted,
    settings.ambientVolume,
    settings.uiSoundsEnabled,
    settings.dimensionMode,
    settings.nostalgiaSynthEnabled,
  ]);

  const refreshHealth = useCallback(async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const resp = await fetch('/api/health', { cache: 'no-store' });
        const contentType = resp.headers.get('content-type') || '';
        if (!resp.ok || !contentType.includes('application/json')) {
          throw new Error('Health check unavailable');
        }
        const data = (await resp.json()) as ServerHealthStatus;
        setHealth(data);
        return;
      } catch {
        if (attempt < 2) {
          await new Promise((resolve) => window.setTimeout(resolve, 450 * (attempt + 1)));
          continue;
        }
        setHealth((prev) => ({ ...prev, ok: false, checkedAt: Date.now() }));
      }
    }
  }, []);

  useEffect(() => {
    void refreshHealth();
    const handleFocusOrOnline = () => {
      void refreshHealth();
    };
    window.addEventListener('focus', handleFocusOrOnline);
    window.addEventListener('online', handleFocusOrOnline);
    return () => {
      window.removeEventListener('focus', handleFocusOrOnline);
      window.removeEventListener('online', handleFocusOrOnline);
    };
  }, [refreshHealth]);

  useEffect(() => {
    if (health.ok) return;
    const retryId = window.setInterval(() => {
      void refreshHealth();
    }, 3000);
    return () => window.clearInterval(retryId);
  }, [health.ok, refreshHealth]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_CONVERSATIONS_KEY, JSON.stringify(conversations));
    } catch {
      // Ignore storage quota overflow
    }
  }, [conversations]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // Ignore
    }
    document.documentElement.setAttribute(
      'data-reduced-motion',
      settings.reducedMotion ? 'true' : 'false'
    );
  }, [settings]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_STATS_KEY, JSON.stringify(tokenStats));
    } catch {
      // Ignore
    }
  }, [tokenStats]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) ?? null,
    [conversations, activeConversationId]
  );

  const activeContextTokens = useMemo(
    () => estimateConversationTokens(activeConversation),
    [activeConversation]
  );

  const updateSettings = useCallback((patch: Partial<LabSettings>) => {
    setSettings((prev) => sanitizeLabSettings({ ...prev, ...patch }));
  }, []);

  const addUsageStats = useCallback(
    (usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number }) => {
      setTokenStats((prev) => accumulateTokenUsage(prev, usage));
    },
    []
  );

  const createConversation = useCallback(
    (mode: PersonaPreset = settings.persona, initialTitle = 'New Transmission'): Conversation => {
      const conv: Conversation = {
        id: `conv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: initialTitle,
        mode,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [],
      };
      setConversations((prev) => [conv, ...prev]);
      setActiveConversationId(conv.id);
      return conv;
    },
    [settings.persona]
  );

  const streamOrFetchAssistant = useCallback(
    async (
      convId: string,
      historyMessages: ChatMessage[],
      assistantMsgId: string,
      overrideSettings?: Partial<LabSettings>
    ) => {
      chatAbortRef.current?.abort();
      const controller = new AbortController();
      chatAbortRef.current = controller;
      setIsStreaming(true);

      const effective = sanitizeLabSettings({ ...settings, ...overrideSettings });
      const systemInstruction = buildSystemInstruction(
        effective.persona,
        effective.maxOutputTokens
      );

      const payloadMessages = historyMessages.map((m) => ({
        role: m.role,
        content: m.content,
        attachments: m.attachments?.map((a) => ({
          name: a.name,
          mimeType: a.mimeType,
          dataBase64: a.dataBase64,
          textPreview: a.textPreview,
        })),
      }));

      try {
        const resp = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: payloadMessages,
            config: {
              model: effective.model,
              thinkingLevel: effective.thinkingLevel,
              maxOutputTokens: effective.maxOutputTokens,
              temperature: effective.temperature,
              topP: effective.topP,
              topK: effective.topK,
              streaming: effective.streaming,
              webSearch: effective.webSearch,
              systemInstruction,
            },
          }),
          signal: controller.signal,
        });

        if (!resp.ok) {
          const errJson = (await resp.json().catch(() => ({}))) as { error?: string };
          throw new Error(errJson.error || `Request failed with status ${resp.status}`);
        }

        setHealth((prev) => (prev.ok ? prev : { ...prev, ok: true, checkedAt: Date.now() }));

        const applyUnaryResponse = async (unaryResp: globalThis.Response) => {
          const data = (await unaryResp.json()) as {
            text?: string;
            sources?: GroundingSource[];
            usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
            model?: string;
          };
          const text = data.text ?? '';
          const fallbackUsage = data.usage ?? {
            promptTokens: historyMessages.reduce(
              (acc, m) => acc + estimateTokenCount(m.content),
              0
            ),
            completionTokens: estimateTokenCount(text),
            totalTokens: 0,
          };
          fallbackUsage.totalTokens =
            fallbackUsage.totalTokens ||
            fallbackUsage.promptTokens + fallbackUsage.completionTokens;
          const actualModel =
            data.model === 'gemini-3.1-flash-lite' || data.model === 'gemini-4-hydrogen'
              ? data.model
              : undefined;

          setConversations((prev) =>
            prev.map((c) =>
              c.id === convId
                ? {
                    ...c,
                    updatedAt: Date.now(),
                    messages: c.messages.map((m) =>
                      m.id === assistantMsgId
                        ? {
                            ...m,
                            content: text,
                            model: actualModel ?? m.model,
                            sources: data.sources ?? [],
                            usage: fallbackUsage,
                          }
                        : m
                    ),
                  }
                : c
            )
          );
          addUsageStats(fallbackUsage);
          void soundscapeRef.current?.playReceiveChime();
        };

        const respContentType = resp.headers.get('content-type') || '';
        if (!effective.streaming || !resp.body || respContentType.includes('application/json')) {
          await applyUnaryResponse(resp);
          return;
        }

        // Parse SSE stream
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let currentEvent = 'message';
        let accumulatedText = '';
        let receivedDone = false;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const rawLine of lines) {
              if (!rawLine.trim()) {
                currentEvent = 'message';
                continue;
              }
              const parsed = parseSseLine(rawLine);
              if (!parsed) continue;
              if (parsed.event) {
                currentEvent = parsed.event;
                continue;
              }
              if (!parsed.data) continue;

              let payload: {
                text?: string;
                sources?: GroundingSource[];
                usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
                model?: string;
                message?: string;
              };
              try {
                payload = JSON.parse(parsed.data) as typeof payload;
              } catch {
                continue;
              }

              if (currentEvent === 'delta' && payload.text) {
                accumulatedText += payload.text;
                setConversations((prev) =>
                  prev.map((c) =>
                    c.id === convId
                      ? {
                          ...c,
                          updatedAt: Date.now(),
                          messages: c.messages.map((m) =>
                            m.id === assistantMsgId ? { ...m, content: accumulatedText } : m
                          ),
                        }
                      : c
                  )
                );
              } else if (currentEvent === 'done') {
                receivedDone = true;
                const finalUsage = payload.usage ?? {
                  promptTokens: historyMessages.reduce(
                    (acc, m) => acc + estimateTokenCount(m.content),
                    0
                  ),
                  completionTokens: estimateTokenCount(accumulatedText),
                  totalTokens: 0,
                };
                finalUsage.totalTokens =
                  finalUsage.totalTokens ||
                  finalUsage.promptTokens + finalUsage.completionTokens;

                const actualModel =
                  payload.model === 'gemini-3.1-flash-lite' || payload.model === 'gemini-4-hydrogen'
                    ? payload.model
                    : undefined;

                setConversations((prev) =>
                  prev.map((c) =>
                    c.id === convId
                      ? {
                          ...c,
                          updatedAt: Date.now(),
                          messages: c.messages.map((m) =>
                            m.id === assistantMsgId
                              ? {
                                  ...m,
                                  content: accumulatedText,
                                  model: actualModel ?? m.model,
                                  sources: payload.sources ?? [],
                                  usage: finalUsage,
                                }
                              : m
                          ),
                        }
                      : c
                  )
                );
                addUsageStats(finalUsage);
                void soundscapeRef.current?.playReceiveChime();
              } else if (currentEvent === 'error') {
                throw new Error(payload.message || 'Streaming interrupted.');
              }
            }
          }
        } catch (streamErr) {
          if ((streamErr as Error).name === 'AbortError') {
            return;
          }
          // If SSE failed before emitting any tokens, fall back once to unary JSON endpoint
          if (!accumulatedText && !controller.signal.aborted) {
            const fallbackResp = await fetch('/api/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                messages: payloadMessages,
                config: {
                  model: effective.model,
                  thinkingLevel: effective.thinkingLevel,
                  maxOutputTokens: effective.maxOutputTokens,
                  temperature: effective.temperature,
                  topP: effective.topP,
                  topK: effective.topK,
                  streaming: false,
                  webSearch: effective.webSearch,
                  systemInstruction,
                },
              }),
              signal: controller.signal,
            });
            if (!fallbackResp.ok) {
              const errJson = (await fallbackResp.json().catch(() => ({}))) as { error?: string };
              throw new Error(errJson.error || (streamErr as Error).message);
            }
            await applyUnaryResponse(fallbackResp);
            return;
          }
          throw streamErr;
        }

        if (!receivedDone && !accumulatedText && !controller.signal.aborted) {
          const fallbackResp = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: payloadMessages,
              config: {
                model: effective.model,
                thinkingLevel: effective.thinkingLevel,
                maxOutputTokens: effective.maxOutputTokens,
                temperature: effective.temperature,
                topP: effective.topP,
                topK: effective.topK,
                streaming: false,
                webSearch: effective.webSearch,
                systemInstruction,
              },
            }),
            signal: controller.signal,
          });
          if (!fallbackResp.ok) {
            const errJson = (await fallbackResp.json().catch(() => ({}))) as { error?: string };
            throw new Error(errJson.error || 'Hawkins stream closed without data.');
          }
          await applyUnaryResponse(fallbackResp);
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }
        const message = err instanceof Error ? err.message : 'Unable to reach Hawkins Terminal.';
        setConversations((prev) =>
          prev.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === assistantMsgId ? { ...m, error: message } : m
                  ),
                }
              : c
          )
        );
      } finally {
        setIsStreaming(false);
        chatAbortRef.current = null;
      }
    },
    [addUsageStats, settings]
  );

  const handleSendMessage = useCallback(
    async (
      customText?: string,
      customAttachments?: Attachment[],
      overrideSettings?: Partial<LabSettings>,
      forceNewConversation = false
    ) => {
      const content = (customText ?? promptInput).trim();
      const files = customAttachments ?? attachments;
      if (!content && files.length === 0) return;

      let targetConv = !forceNewConversation ? activeConversation : null;
      if (!targetConv) {
        targetConv = createConversation(
          overrideSettings?.persona ?? settings.persona,
          createConversationTitle(content || files[0]?.name || 'Document Analysis')
        );
      } else if (targetConv.messages.length === 0) {
        const title = createConversationTitle(content || files[0]?.name || 'New Transmission');
        setConversations((prev) =>
          prev.map((c) => (c.id === targetConv!.id ? { ...c, title } : c))
        );
      }

      const userMsg: ChatMessage = {
        id: `msg-u-${Date.now()}`,
        role: 'user',
        content: content || 'Analyze the attached files.',
        createdAt: Date.now(),
        attachments: files.length > 0 ? files : undefined,
      };

      const assistantMsg: ChatMessage = {
        id: `msg-a-${Date.now() + 1}`,
        role: 'assistant',
        content: '',
        createdAt: Date.now() + 1,
        model: overrideSettings?.model ?? settings.model,
      };

      const nextHistory = [...targetConv.messages, userMsg];
      setConversations((prev) =>
        prev.map((c) =>
          c.id === targetConv!.id
            ? {
                ...c,
                updatedAt: Date.now(),
                messages: [...nextHistory, assistantMsg],
              }
            : c
        )
      );

      if (!customText) setPromptInput('');
      if (!customAttachments) setAttachments([]);
      setWorkspace('chat');
      void soundscapeRef.current?.playTransmit();

      await streamOrFetchAssistant(
        targetConv.id,
        nextHistory,
        assistantMsg.id,
        overrideSettings
      );
    },
    [
      activeConversation,
      attachments,
      createConversation,
      promptInput,
      settings.model,
      settings.persona,
      streamOrFetchAssistant,
    ]
  );

  const handleHeroAttachments = useCallback(
    (newFiles: Attachment[]) => {
      setAttachments((prev) => [...prev, ...newFiles]);
    },
    []
  );

  const handleQuickAction = (action: QuickActionType) => {
    switch (action) {
      case 'deep-research':
        setWorkspace('research');
        break;
      case 'image-generation':
        setWorkspace('visual');
        break;
      case 'coding-lab': {
        updateSettings({ persona: 'coding' });
        const conv = createConversation('coding', 'Coding Lab Session');
        setActiveConversationId(conv.id);
        setWorkspace('chat');
        break;
      }
      case 'web-search':
        updateSettings({ webSearch: true });
        break;
      case 'ask-anything':
        // Focus handled inside HomepageHero
        break;
      case 'document-analysis':
        updateSettings({ persona: 'analyst' });
        break;
    }
  };

  const handleRegenerateMessage = async (
    assistantMsgId: string,
    overrideSettings?: Partial<LabSettings>
  ) => {
    if (!activeConversation || isStreaming) return;
    const idx = activeConversation.messages.findIndex((m) => m.id === assistantMsgId);
    if (idx <= 0) return;

    const historyUpToUser = activeConversation.messages.slice(0, idx);
    const replacementAssistant: ChatMessage = {
      id: `msg-a-${Date.now()}`,
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
      model: overrideSettings?.model ?? settings.model,
    };

    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConversation.id
          ? { ...c, messages: [...historyUpToUser, replacementAssistant] }
          : c
      )
    );

    await streamOrFetchAssistant(
      activeConversation.id,
      historyUpToUser,
      replacementAssistant.id,
      overrideSettings
    );
  };

  const handleEditUserMessage = async (userMsgId: string, newContent: string) => {
    if (!activeConversation || isStreaming) return;
    const idx = activeConversation.messages.findIndex((m) => m.id === userMsgId);
    if (idx === -1) return;

    const updatedUser: ChatMessage = {
      ...activeConversation.messages[idx],
      content: newContent,
      createdAt: Date.now(),
    };
    const nextHistory = [...activeConversation.messages.slice(0, idx), updatedUser];
    const replacementAssistant: ChatMessage = {
      id: `msg-a-${Date.now() + 1}`,
      role: 'assistant',
      content: '',
      createdAt: Date.now() + 1,
      model: settings.model,
    };

    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConversation.id
          ? { ...c, updatedAt: Date.now(), messages: [...nextHistory, replacementAssistant] }
          : c
      )
    );

    await streamOrFetchAssistant(
      activeConversation.id,
      nextHistory,
      replacementAssistant.id
    );
  };

  const handleSendReportToChat = (
    query: string,
    reportMarkdown: string,
    sources: GroundingSource[]
  ) => {
    const conv = createConversation('researcher', `Dossier: ${createConversationTitle(query)}`);
    const userMsg: ChatMessage = {
      id: `msg-u-${Date.now()}`,
      role: 'user',
      content: `Deep Research Query: ${query}`,
      createdAt: Date.now(),
    };
    const assistantMsg: ChatMessage = {
      id: `msg-a-${Date.now() + 1}`,
      role: 'assistant',
      content: reportMarkdown,
      sources,
      createdAt: Date.now() + 1,
      model: 'gemini-4-hydrogen',
    };
    setConversations((prev) =>
      prev.map((c) => (c.id === conv.id ? { ...c, messages: [userMsg, assistantMsg] } : c))
    );
    setWorkspace('chat');
  };

  const handleSendVisualToChat = (visual: VisualAssetResult) => {
    const conv = createConversation('hawkins', `Visual: ${visual.title}`);
    const userMsg: ChatMessage = {
      id: `msg-u-${Date.now()}`,
      role: 'user',
      content: `Synthesize visual concept: ${visual.prompt} (${visual.style}, ${visual.aspectRatio})`,
      createdAt: Date.now(),
    };
    const assistantMsg: ChatMessage = {
      id: `msg-a-${Date.now() + 1}`,
      role: 'assistant',
      content: `### ${visual.title}\n\n${visual.description}\n\n\`\`\`svg\n${visual.svgMarkup}\n\`\`\``,
      createdAt: Date.now() + 1,
      model: 'gemini-4-hydrogen',
    };
    setConversations((prev) =>
      prev.map((c) => (c.id === conv.id ? { ...c, messages: [userMsg, assistantMsg] } : c))
    );
    setWorkspace('chat');
  };

  return (
    <div
      data-workspace={workspace}
      data-dimension={settings.dimensionMode}
      className="relative flex min-h-screen flex-col overflow-x-hidden bg-[#080808] text-[#EDE9E8]"
    >
      <AtmosphericBackground
        workspace={workspace}
        reducedMotion={settings.reducedMotion}
        crtScanlines={settings.crtScanlines}
        christmasLights={settings.christmasLights}
        dimensionMode={settings.dimensionMode}
      />

      <TopHeader
        workspace={workspace}
        onNavigate={(nextWs) => {
          void soundscapeRef.current?.playKeyClick(2);
          setWorkspace(nextWs);
        }}
        model={settings.model}
        onModelChange={(model) => {
          void soundscapeRef.current?.playKeyClick(4);
          updateSettings({ model });
        }}
        health={health}
        onRefreshHealth={() => void refreshHealth()}
        isBusy={isStreaming}
        ambientSoundMuted={settings.ambientSoundMuted}
        onToggleAmbientMute={() => {
          const nextMuted = !settings.ambientSoundMuted;
          updateSettings({ ambientSoundMuted: nextMuted });
          void soundscapeRef.current?.unlockAndSync(
            nextMuted,
            settings.ambientVolume,
            settings.uiSoundsEnabled,
            settings.dimensionMode,
            settings.nostalgiaSynthEnabled
          );
          if (!nextMuted) {
            void soundscapeRef.current?.playKeyClick(3);
          }
        }}
        onOpenSettings={() => {
          void soundscapeRef.current?.playKeyClick(1);
          setSettingsOpen(true);
        }}
        onToggleMobileSidebar={
          workspace === 'chat' ? () => setMobileSidebarOpen((v) => !v) : undefined
        }
      />

      {workspace === 'home' && (
        <HomepageHero
          promptValue={promptInput}
          onPromptChange={setPromptInput}
          attachments={attachments}
          onAddAttachments={handleHeroAttachments}
          onRemoveAttachment={(id) =>
            setAttachments((prev) => prev.filter((a) => a.id !== id))
          }
          webSearch={settings.webSearch}
          onToggleWebSearch={() => updateSettings({ webSearch: !settings.webSearch })}
          onSubmitPrompt={() => void handleSendMessage(undefined, undefined, undefined, true)}
          onQuickAction={handleQuickAction}
          christmasLights={settings.christmasLights}
          dimensionMode={settings.dimensionMode}
          onChangeDimensionMode={(mode) => {
            updateSettings({ dimensionMode: mode });
            void soundscapeRef.current?.playGateToggle(mode === 'upside-down');
          }}
          onPlayBulbChime={(idx) => {
            void soundscapeRef.current?.playBulbChime(idx);
          }}
          onPlayNostalgiaTheme={() => {
            void soundscapeRef.current?.playNostalgiaTheme(3);
          }}
          onPlayUiClick={() => {
            void soundscapeRef.current?.playKeyClick();
          }}
          recentConversationsCount={conversations.length}
          onResumeLatestChat={() => {
            if (conversations[0]) setActiveConversationId(conversations[0].id);
            setWorkspace('chat');
          }}
        />
      )}

      {workspace === 'chat' && (
        <ChatWorkspace
          conversations={conversations}
          activeConversation={activeConversation}
          onSelectConversation={(id) => {
            void soundscapeRef.current?.playKeyClick();
            setActiveConversationId(id);
          }}
          onNewConversation={() => {
            void soundscapeRef.current?.playKeyClick(2);
            const conv = createConversation(settings.persona, 'New Transmission');
            setActiveConversationId(conv.id);
          }}
          onDeleteConversation={(id) => {
            void soundscapeRef.current?.playKeyClick(-2);
            setConversations((prev) => {
              const remaining = prev.filter((c) => c.id !== id);
              if (activeConversationId === id) {
                setActiveConversationId(remaining[0]?.id ?? null);
              }
              return remaining;
            });
          }}
          onRenameConversation={(id, title) => {
            setConversations((prev) =>
              prev.map((c) => (c.id === id ? { ...c, title } : c))
            );
          }}
          onNavigateWorkspace={(nextWs) => {
            void soundscapeRef.current?.playKeyClick(2);
            setWorkspace(nextWs);
          }}
          composerValue={promptInput}
          onComposerChange={setPromptInput}
          attachments={attachments}
          onAddAttachments={(files) => setAttachments((prev) => [...prev, ...files])}
          onRemoveAttachment={(id) =>
            setAttachments((prev) => prev.filter((a) => a.id !== id))
          }
          settings={settings}
          onToggleWebSearch={() => {
            void soundscapeRef.current?.playKeyClick(1);
            updateSettings({ webSearch: !settings.webSearch });
          }}
          onSendMessage={() => void handleSendMessage()}
          onStopStreaming={() => {
            void soundscapeRef.current?.playKeyClick(-3);
            chatAbortRef.current?.abort();
            setIsStreaming(false);
          }}
          onRegenerateMessage={(id) => {
            void soundscapeRef.current?.playTransmit();
            void handleRegenerateMessage(id);
          }}
          onRetryWithoutWebSearch={(id) => {
            void soundscapeRef.current?.playTransmit();
            updateSettings({ webSearch: false });
            void handleRegenerateMessage(id, { webSearch: false });
          }}
          onEditUserMessage={(id, next) => {
            void soundscapeRef.current?.playTransmit();
            void handleEditUserMessage(id, next);
          }}
          onQuickFollowUp={(followUp) => void handleSendMessage(followUp)}
          onPlayUiClick={() => {
            void soundscapeRef.current?.playKeyClick();
          }}
          isStreaming={isStreaming}
          tokenStats={tokenStats}
          mobileSidebarOpen={mobileSidebarOpen}
          onCloseMobileSidebar={() => setMobileSidebarOpen(false)}
        />
      )}

      {workspace === 'research' && (
        <DeepResearchWorkspace
          onSendReportToChat={handleSendReportToChat}
          onAddUsage={addUsageStats}
        />
      )}

      {workspace === 'visual' && (
        <VisualLabWorkspace
          onSendVisualToChat={handleSendVisualToChat}
          onAddUsage={addUsageStats}
        />
      )}

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={updateSettings}
        tokenStats={tokenStats}
        onResetTokenStats={() => setTokenStats(DEFAULT_TOKEN_STATS)}
        activeContextTokens={activeContextTokens}
        health={health}
        onRefreshHealth={() => void refreshHealth()}
        onPlayNostalgiaTheme={() => {
          void soundscapeRef.current?.playNostalgiaTheme(2);
        }}
      />
    </div>
  );
}
