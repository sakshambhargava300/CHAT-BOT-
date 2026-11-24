import {
  Code2,
  FileSearch,
  Globe,
  Image as ImageIcon,
  MessageSquare,
  Microscope,
} from 'lucide-react';
import { useMemo, useRef } from 'react';
import type { Attachment } from '../types/app';
import { ALPHABET_WALL_LETTERS, getActiveAlphabetIndices } from '../utils/labLogic';
import { ComposerInput } from './ComposerInput';

export type QuickActionType =
  | 'deep-research'
  | 'ask-anything'
  | 'coding-lab'
  | 'document-analysis'
  | 'image-generation'
  | 'web-search';

interface HomepageHeroProps {
  promptValue: string;
  onPromptChange: (value: string) => void;
  attachments: Attachment[];
  onAddAttachments: (files: Attachment[]) => void;
  onRemoveAttachment: (id: string) => void;
  webSearch: boolean;
  onToggleWebSearch: () => void;
  onSubmitPrompt: () => void;
  onQuickAction: (action: QuickActionType) => void;
  christmasLights: boolean;
  recentConversationsCount: number;
  onResumeLatestChat: () => void;
}

const BULB_PALETTE = ['#E50914', '#F59E0B', '#60A5FA', '#34D399', '#F43F5E'];

const QUICK_ACTIONS: Array<{
  id: QuickActionType;
  title: string;
  description: string;
  icon: typeof Microscope;
}> = [
  {
    id: 'deep-research',
    title: 'Deep Research',
    description: 'Multi-stage web sweeps, source verification, and dossier synthesis.',
    icon: Microscope,
  },
  {
    id: 'ask-anything',
    title: 'Ask Anything',
    description: 'Open a direct neural transmission across the Hawkins gate.',
    icon: MessageSquare,
  },
  {
    id: 'coding-lab',
    title: 'Coding Lab',
    description: 'Debug architectures, write clean TypeScript, and trace anomalies.',
    icon: Code2,
  },
  {
    id: 'document-analysis',
    title: 'Document Analysis',
    description: 'Inspect uploaded reports, logs, codebases, PDFs, or images.',
    icon: FileSearch,
  },
  {
    id: 'image-generation',
    title: 'Image Generation',
    description: 'Synthesize retro 1980s vector visuals, posters, and blueprints.',
    icon: ImageIcon,
  },
  {
    id: 'web-search',
    title: 'Web Search',
    description: 'Query live external intelligence backed by Google Search.',
    icon: Globe,
  },
];

export function HomepageHero({
  promptValue,
  onPromptChange,
  attachments,
  onAddAttachments,
  onRemoveAttachment,
  webSearch,
  onToggleWebSearch,
  onSubmitPrompt,
  onQuickAction,
  christmasLights,
  recentConversationsCount,
  onResumeLatestChat,
}: HomepageHeroProps) {
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeIndices = useMemo(() => getActiveAlphabetIndices(promptValue), [promptValue]);

  const handleCardClick = (action: QuickActionType) => {
    if (action === 'ask-anything') {
      inputRef.current?.focus();
    } else if (action === 'document-analysis') {
      fileInputRef.current?.click();
      return;
    }
    onQuickAction(action);
  };

  return (
    <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-4 py-4 sm:px-6 sm:py-6">
      {/* Dramatic Cinematic Title Lockup */}
      <div className="mb-4 flex w-full max-w-3xl flex-col items-center text-center">
        <div className="st-rule-bar mb-3 w-48 sm:w-72" aria-hidden="true" />

        <h1 className="font-hawkins-display st-title-glow animate-hawkins-glitch text-4xl font-bold tracking-[0.12em] uppercase select-none sm:text-5xl lg:text-6xl">
          STRANGER THINGS
        </h1>

        <div className="mt-1.5 flex items-center gap-3">
          <span className="h-px w-10 bg-[#E50914]/60" aria-hidden="true" />
          <span className="font-hawkins-mono text-[11px] tracking-[0.35em] text-[#FF5C66] uppercase">
            HAWKINS NATIONAL LABORATORY
          </span>
          <span className="h-px w-10 bg-[#E50914]/60" aria-hidden="true" />
        </div>

        {/* Joyce Byers Alphabet Wall Motif */}
        {christmasLights && (
          <div
            className="mt-3.5 hidden flex-wrap items-center justify-center gap-2 rounded-lg border border-white/8 bg-[#10090B]/80 px-4 py-1.5 sm:flex"
            aria-label="Hawkins alphabet wall signal indicator"
          >
            {ALPHABET_WALL_LETTERS.map((letter, idx) => {
              const color = BULB_PALETTE[idx % BULB_PALETTE.length];
              const isLit = activeIndices.includes(idx);
              return (
                <div key={letter} className="flex flex-col items-center gap-1">
                  <span
                    className={`h-2 w-2 rounded-full transition-all duration-150 ${
                      isLit ? 'scale-125 opacity-100' : 'opacity-35'
                    }`}
                    style={{
                      backgroundColor: color,
                      boxShadow: isLit ? `0 0 12px ${color}, 0 0 22px ${color}` : 'none',
                    }}
                  />
                  <span
                    className={`font-hawkins-mono text-[10px] leading-none ${
                      isLit ? 'font-semibold text-white' : 'text-zinc-500'
                    }`}
                  >
                    {letter}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <p className="mt-4 max-w-xl text-base font-medium text-zinc-200 sm:text-lg">
          The gate is open. What do you want to know?
        </p>
      </div>

      {/* Primary Center Composer */}
      <div className="w-full max-w-3xl">
        <ComposerInput
          variant="hero"
          value={promptValue}
          onChange={onPromptChange}
          attachments={attachments}
          onAddAttachments={onAddAttachments}
          onRemoveAttachment={onRemoveAttachment}
          webSearch={webSearch}
          onToggleWebSearch={onToggleWebSearch}
          onSubmit={onSubmitPrompt}
          inputRef={inputRef}
          fileInputRef={fileInputRef}
          placeholder="Ask Hawkins AI, drop a classified document, or open a search vector..."
        />

        {recentConversationsCount > 0 && (
          <div className="mt-2.5 flex items-center justify-center">
            <button
              type="button"
              onClick={onResumeLatestChat}
              className="font-hawkins-mono text-xs text-zinc-400 underline decoration-white/20 underline-offset-4 transition-colors hover:text-[#FF5C66] hover:decoration-[#E50914]/60"
            >
              Resume previous transmission ({recentConversationsCount} saved)
            </button>
          </div>
        )}
      </div>

      {/* Quick Action Cards (6 requested capabilities) */}
      <section aria-label="Quick actions" className="mt-5 w-full max-w-4xl">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_ACTIONS.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => handleCardClick(card.id)}
                className="group flex flex-col items-start rounded-xl border border-white/10 bg-[#100B0D]/88 p-3.5 text-left transition-all duration-200 hover:border-[#E50914]/55 hover:bg-[#190C10]/95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E50914]"
              >
                <div className="mb-2.5 flex w-full items-center justify-between">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#E50914]/30 bg-[#240A0D] text-[#FF5C66] transition-colors group-hover:border-[#E50914]/70 group-hover:text-white">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="font-hawkins-mono text-[11px] text-zinc-500 transition-colors group-hover:text-zinc-300">
                    Open
                  </span>
                </div>
                <h2 className="text-sm font-semibold text-zinc-100 group-hover:text-white">
                  {card.title}
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                  {card.description}
                </p>
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}
