import {
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  MessageSquarePlus,
  Microscope,
  Search,
  Square,
} from 'lucide-react';
import { useRef, useState } from 'react';
import type { GroundingSource, ResearchSession, ResearchStageId } from '../types/app';
import { createInitialResearchStages, parseSseLine } from '../utils/labLogic';
import { MarkdownRenderer } from './MarkdownRenderer';

interface DeepResearchWorkspaceProps {
  onSendReportToChat: (query: string, reportMarkdown: string, sources: GroundingSource[]) => void;
  onAddUsage: (usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number }) => void;
}

export function DeepResearchWorkspace({
  onSendReportToChat,
  onAddUsage,
}: DeepResearchWorkspaceProps) {
  const [queryInput, setQueryInput] = useState('');
  const [depth, setDepth] = useState<'standard' | 'exhaustive'>('standard');
  const [copiedReport, setCopiedReport] = useState(false);

  const [session, setSession] = useState<ResearchSession>({
    id: 'research-init',
    query: '',
    depth: 'standard',
    createdAt: Date.now(),
    isRunning: false,
    stages: createInitialResearchStages(),
    subQueries: [],
    sources: [],
    analysisNotes: [],
    reportMarkdown: '',
  });

  const abortRef = useRef<AbortController | null>(null);

  const updateStage = (
    id: ResearchStageId,
    status: 'pending' | 'active' | 'done' | 'error',
    detail?: string
  ) => {
    setSession((prev) => ({
      ...prev,
      stages: prev.stages.map((st) =>
        st.id === id ? { ...st, status, detail: detail ?? st.detail } : st
      ),
    }));
  };

  const handleStop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setSession((prev) => ({ ...prev, isRunning: false }));
  };

  const handleStartResearch = async (overrideQuery?: string) => {
    const targetQuery = (overrideQuery ?? queryInput).trim();
    if (!targetQuery || session.isRunning) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setSession({
      id: `res-${Date.now()}`,
      query: targetQuery,
      depth,
      createdAt: Date.now(),
      isRunning: true,
      stages: createInitialResearchStages(),
      subQueries: [],
      sources: [],
      analysisNotes: [],
      reportMarkdown: '',
      error: undefined,
    });

    try {
      const response = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: targetQuery, depth }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const errBody = await response.json().catch(() => ({ error: 'Research request failed.' }));
        throw new Error((errBody as { error?: string }).error || 'Research request failed.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentEvent = 'message';

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
          const parsedLine = parseSseLine(rawLine);
          if (!parsedLine) continue;
          if (parsedLine.event) {
            currentEvent = parsedLine.event;
            continue;
          }
          if (!parsedLine.data) continue;

          try {
            const payload = JSON.parse(parsedLine.data) as Record<string, unknown>;
            if (currentEvent === 'stage') {
              updateStage(
                payload.id as ResearchStageId,
                payload.status as 'pending' | 'active' | 'done' | 'error',
                payload.detail as string | undefined
              );
            } else if (currentEvent === 'subqueries') {
              setSession((prev) => ({
                ...prev,
                subQueries: (payload.subQueries as string[]) || [],
              }));
            } else if (currentEvent === 'source') {
              const src = payload as unknown as GroundingSource;
              setSession((prev) => {
                if (prev.sources.some((s) => s.url === src.url)) return prev;
                return { ...prev, sources: [...prev.sources, src] };
              });
            } else if (currentEvent === 'analysis') {
              setSession((prev) => ({
                ...prev,
                analysisNotes: (payload.notes as string[]) || [],
              }));
            } else if (currentEvent === 'report_delta') {
              const delta = String(payload.text || '');
              setSession((prev) => ({
                ...prev,
                reportMarkdown: prev.reportMarkdown + delta,
              }));
            } else if (currentEvent === 'done') {
              if (payload.usage) {
                onAddUsage(
                  payload.usage as {
                    promptTokens?: number;
                    completionTokens?: number;
                    totalTokens?: number;
                  }
                );
              }
            } else if (currentEvent === 'error') {
              throw new Error(String(payload.message || 'Research pipeline failed.'));
            }
          } catch (innerErr) {
            if (currentEvent === 'error') {
              throw innerErr;
            }
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setSession((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : 'Research sweep interrupted.',
        }));
      }
    } finally {
      setSession((prev) => ({ ...prev, isRunning: false }));
      abortRef.current = null;
    }
  };

  const handleCopyReport = async () => {
    if (!session.reportMarkdown) return;
    await navigator.clipboard.writeText(session.reportMarkdown);
    setCopiedReport(true);
    window.setTimeout(() => setCopiedReport(false), 1800);
  };

  const handleDownloadDossier = () => {
    if (!session.reportMarkdown) return;
    const sourcesBlock =
      session.sources.length > 0
        ? `\n\n## Verified Sources\n${session.sources
            .map((s, i) => `${i + 1}. [${s.title}](${s.url})`)
            .join('\n')}`
        : '';
    const blob = new Blob(
      [`# Hawkins Lab Dossier: ${session.query}\n\n${session.reportMarkdown}${sourcesBlock}`],
      { type: 'text/markdown;charset=utf-8' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hawkins-dossier-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6">
      {/* Lab Header & Query Console */}
      <section className="rounded-xl border border-white/12 bg-[#0D090B]/95 p-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium tracking-[0.18em] text-[#FF5C66] uppercase">
              <Microscope className="h-4 w-4" aria-hidden="true" />
              <span>Project Indigo · Deep Research Laboratory</span>
            </div>
            <h1 className="font-hawkins-display mt-1.5 text-2xl font-bold text-white sm:text-3xl">
              Hawkins Intelligence Dossier
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              Multi-vector Google Search grounding, source verification, and structured synthesis.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-hawkins-mono text-xs text-zinc-400">Sweep Depth:</span>
            <div className="inline-flex rounded-lg border border-white/12 bg-[#160D10] p-1">
              {(['standard', 'exhaustive'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setDepth(mode)}
                  disabled={session.isRunning}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize whitespace-nowrap transition-colors ${
                    depth === mode
                      ? 'bg-[#E50914] text-white'
                      : 'text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleStartResearch();
          }}
          className="mt-4 flex flex-col gap-3 sm:flex-row"
        >
          <label htmlFor="deep-research-query" className="sr-only">
            Research topic
          </label>
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-zinc-500"
              aria-hidden="true"
            />
            <input
              id="deep-research-query"
              type="text"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder="Enter an intelligence topic (e.g., History of MKUltra and Project Montauk, or Quantum error correction 2025)..."
              className="h-11 w-full rounded-lg border border-white/15 bg-[#08080A] pr-4 pl-10 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-[#E50914] focus:outline-none"
            />
          </div>

          {session.isRunning ? (
            <button
              type="button"
              onClick={handleStop}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[#E50914]/70 bg-[#240A0D] px-5 text-sm font-semibold whitespace-nowrap text-white transition-colors hover:bg-[#3A0E14]"
            >
              <Square className="h-4 w-4 fill-current" />
              <span>Abort Sweep</span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={!queryInput.trim()}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#E50914] px-6 text-sm font-semibold whitespace-nowrap text-white transition-colors hover:bg-[#FF1A26] disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
            >
              <Microscope className="h-4 w-4" />
              <span>Start Research</span>
            </button>
          )}
        </form>

        {/* 4-Stage Pipeline Tracker */}
        <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {session.stages.map((stage, idx) => {
            const active = stage.status === 'active';
            const done = stage.status === 'done';
            return (
              <div
                key={stage.id}
                className={`rounded-lg border px-3.5 py-2.5 transition-colors ${
                  active
                    ? 'border-[#E50914]/70 bg-[#240A0D]/80'
                    : done
                      ? 'border-emerald-500/35 bg-[#0B1612]/70'
                      : 'border-white/8 bg-[#120D10]/70'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-hawkins-mono text-[11px] tracking-wider text-zinc-400 uppercase">
                    Stage 0{idx + 1}
                  </span>
                  {active ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-[#FF5C66]" />
                  ) : done ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <span className="font-hawkins-mono text-[11px] text-zinc-500">Standby</span>
                  )}
                </div>
                <div className="mt-1 text-sm font-semibold text-zinc-100">{stage.label}</div>
                <div className="mt-0.5 truncate text-xs text-zinc-400" title={stage.detail}>
                  {stage.detail}
                </div>
              </div>
            );
          })}
        </div>

        {session.error && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-[#E50914]/50 bg-[#240A0D] px-4 py-3 text-sm text-[#FF9CA2]"
          >
            {session.error}
          </div>
        )}
      </section>

      {/* Main Split Dossier Workspace */}
      <div className="grid flex-1 grid-cols-1 items-stretch gap-5 lg:grid-cols-12">
        {/* Left Column: Search Vectors & Verified Citations */}
        <aside className="flex flex-col gap-4 rounded-xl border border-white/12 bg-[#0D090B]/95 p-4 lg:col-span-4">
          <div>
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <h2 className="text-sm font-semibold text-white">Verified Citations</h2>
              <span className="font-hawkins-mono text-xs text-zinc-400">
                {session.sources.length} sources
              </span>
            </div>

            {session.subQueries.length > 0 && (
              <div className="mt-3 space-y-1.5">
                <span className="font-hawkins-mono text-[11px] tracking-wider text-zinc-400 uppercase">
                  Active Search Vectors
                </span>
                <ul className="space-y-1">
                  {session.subQueries.map((sq, i) => (
                    <li
                      key={i}
                      className="rounded border border-white/8 bg-[#150E11] px-2.5 py-1.5 text-xs text-zinc-300"
                    >
                      {i + 1}. {sq}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-4 space-y-2.5">
              {session.sources.length === 0 ? (
                <div className="rounded-lg border border-dashed border-white/10 p-4 text-center text-xs text-zinc-500">
                  {session.isRunning
                    ? 'Scanning external web indices via Google Search...'
                    : 'Grounded web citations and source links will populate here when research runs.'}
                </div>
              ) : (
                session.sources.map((src, index) => (
                  <a
                    key={src.url}
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block rounded-lg border border-white/10 bg-[#140D10] p-3 transition-colors hover:border-[#E50914]/55 hover:bg-[#1E0F13]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-hawkins-mono text-xs font-semibold text-[#FF5C66]">
                        [{index + 1}]
                      </span>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-zinc-500 group-hover:text-zinc-200" />
                    </div>
                    <div className="mt-1 line-clamp-2 text-xs font-medium text-zinc-100">
                      {src.title}
                    </div>
                    <div className="font-hawkins-mono mt-1 truncate text-[11px] text-zinc-500">
                      {src.url}
                    </div>
                  </a>
                ))
              )}
            </div>
          </div>

          {session.analysisNotes.length > 0 && (
            <div className="mt-auto border-t border-white/10 pt-3">
              <span className="font-hawkins-mono text-[11px] tracking-wider text-zinc-400 uppercase">
                Analysis Log
              </span>
              <ul className="mt-1.5 space-y-1 text-xs text-zinc-400">
                {session.analysisNotes.map((note, idx) => (
                  <li key={idx}>· {note}</li>
                ))}
              </ul>
            </div>
          )}
        </aside>

        {/* Right Column: Generated Research Report */}
        <section className="flex flex-col rounded-xl border border-white/12 bg-[#0D090B]/95 p-5 lg:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div>
              <h2 className="font-hawkins-display text-lg font-bold text-white">
                Generated Intelligence Report
              </h2>
              <p className="font-hawkins-mono text-xs text-zinc-400">
                {session.query ? `Subject: ${session.query}` : 'Awaiting research query'}
              </p>
            </div>

            {session.reportMarkdown && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyReport}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/12 bg-[#160E11] px-3 text-xs font-medium whitespace-nowrap text-zinc-200 transition-colors hover:border-white/30 hover:text-white"
                >
                  {copiedReport ? (
                    <>
                      <ClipboardCheck className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy Report</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleDownloadDossier}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/12 bg-[#160E11] px-3 text-xs font-medium whitespace-nowrap text-zinc-200 transition-colors hover:border-white/30 hover:text-white"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Export .md</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    onSendReportToChat(session.query, session.reportMarkdown, session.sources)
                  }
                  className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#E50914] px-3 text-xs font-semibold whitespace-nowrap text-white transition-colors hover:bg-[#FF1A26]"
                >
                  <MessageSquarePlus className="h-3.5 w-3.5" />
                  <span>Discuss in Chat</span>
                </button>
              </div>
            )}
          </div>

          <div className="mt-4 flex-1 overflow-y-auto">
            {session.reportMarkdown ? (
              <MarkdownRenderer content={session.reportMarkdown} />
            ) : session.isRunning ? (
              <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
                <Loader2 className="h-7 w-7 animate-spin text-[#E50914]" />
                <p className="text-sm text-zinc-300">
                  Executing live search sweeps and cross-referencing sources...
                </p>
              </div>
            ) : (
              <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
                <Microscope className="h-8 w-8 text-zinc-600" />
                <div className="max-w-md space-y-1">
                  <p className="text-sm font-medium text-zinc-300">
                    No active intelligence dossier
                  </p>
                  <p className="text-xs text-zinc-500">
                    Enter a topic above to run multi-step web search grounding and generate a
                    citation-backed Markdown dossier.
                  </p>
                </div>
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  {[
                    'Project MKUltra and Montauk historical records',
                    'Latest breakthroughs in fusion energy 2025',
                    'How WebGPU compute shaders work',
                  ].map((sample) => (
                    <button
                      key={sample}
                      type="button"
                      onClick={() => {
                        setQueryInput(sample);
                        void handleStartResearch(sample);
                      }}
                      className="rounded-md border border-white/10 bg-[#150E11] px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:border-[#E50914]/50 hover:text-white"
                    >
                      {sample}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
