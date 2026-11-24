import {
  Code2,
  FileSearch,
  Globe,
  Image as ImageIcon,
  MessageSquare,
  Microscope,
  Music2,
  Sparkles,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Attachment } from '../types/app';
import {
  ALPHABET_WALL_LETTERS,
  getActiveAlphabetIndices,
  getNostalgiaArpPattern,
  NOSTALGIA_ARP_STEP_MS,
} from '../utils/labLogic';
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
  dimensionMode: 'hawkins' | 'upside-down';
  onChangeDimensionMode: (mode: 'hawkins' | 'upside-down') => void;
  onPlayBulbChime: (letterIndex: number) => void;
  onPlayNostalgiaTheme: () => void;
  onPlayUiClick: () => void;
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

const SIGNAL_SEQUENCES = [
  { label: 'RUN', word: 'RUN' },
  { label: 'HELLO', word: 'HELLO' },
  { label: 'GATE', word: 'GATE' },
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
  dimensionMode,
  onChangeDimensionMode,
  onPlayBulbChime,
  onPlayNostalgiaTheme,
  onPlayUiClick,
  recentConversationsCount,
  onResumeLatestChat,
}: HomepageHeroProps) {
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sequenceTimersRef = useRef<number[]>([]);

  const [sequenceLitIndex, setSequenceLitIndex] = useState<number | null>(null);
  const [clickedBulbIndex, setClickedBulbIndex] = useState<number | null>(null);
  const [synthThemePlaying, setSynthThemePlaying] = useState(false);

  useEffect(() => {
    return () => {
      sequenceTimersRef.current.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  const typedIndices = useMemo(() => getActiveAlphabetIndices(promptValue), [promptValue]);

  const handleCardClick = (action: QuickActionType) => {
    onPlayUiClick();
    if (action === 'ask-anything') {
      inputRef.current?.focus();
    } else if (action === 'document-analysis') {
      fileInputRef.current?.click();
      return;
    }
    onQuickAction(action);
  };

  const handleBulbClick = (idx: number, letter: string) => {
    onPlayBulbChime(idx);
    setClickedBulbIndex(idx);
    window.setTimeout(() => {
      setClickedBulbIndex((curr) => (curr === idx ? null : curr));
    }, 450);
    onPromptChange(promptValue + letter);
    inputRef.current?.focus();
  };

  const handleSpellSequence = (word: string) => {
    sequenceTimersRef.current.forEach((id) => window.clearTimeout(id));
    sequenceTimersRef.current = [];
    setSynthThemePlaying(false);

    const chars = word.toUpperCase().split('');
    chars.forEach((ch, step) => {
      const idx = ch.charCodeAt(0) - 65;
      if (idx < 0 || idx > 25) return;
      const t = window.setTimeout(() => {
        setSequenceLitIndex(idx);
        onPlayBulbChime(idx);
      }, step * 260);
      sequenceTimersRef.current.push(t);
    });

    const endTimer = window.setTimeout(() => {
      setSequenceLitIndex(null);
    }, chars.length * 260 + 380);
    sequenceTimersRef.current.push(endTimer);
  };

  const handleTriggerNostalgiaTheme = () => {
    sequenceTimersRef.current.forEach((id) => window.clearTimeout(id));
    sequenceTimersRef.current = [];
    setSynthThemePlaying(true);
    onPlayNostalgiaTheme();

    const pattern = getNostalgiaArpPattern(3);
    pattern.forEach((step) => {
      const t = window.setTimeout(() => {
        setSequenceLitIndex(step.letterIndex);
      }, step.delayMs);
      sequenceTimersRef.current.push(t);
    });

    const endTimer = window.setTimeout(() => {
      setSequenceLitIndex(null);
      setSynthThemePlaying(false);
    }, pattern.length * NOSTALGIA_ARP_STEP_MS + 350);
    sequenceTimersRef.current.push(endTimer);
  };

  return (
    <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-4 py-3 sm:px-6 sm:py-3">
      {/* Dramatic Cinematic Title Lockup */}
      <div className="mb-2.5 flex w-full max-w-3xl flex-col items-center text-center">
        <div className="st-rule-bar mb-1.5 w-48 sm:w-72" aria-hidden="true" />

        <h1 className="font-hawkins-display st-title-glow animate-hawkins-glitch text-4xl font-bold tracking-[0.12em] uppercase select-none sm:text-5xl lg:text-[3.5rem] lg:leading-none">
          STRANGER THINGS
        </h1>

        <div className="mt-1.5 flex flex-wrap items-center justify-center gap-3">
          <span className="h-px w-8 bg-[#E50914]/60" aria-hidden="true" />
          <span className="font-hawkins-mono text-[11px] tracking-[0.3em] text-[#FF5C66] uppercase">
            HAWKINS NATIONAL LABORATORY
          </span>
          <span className="h-px w-8 bg-[#E50914]/60" aria-hidden="true" />
        </div>

        {/* Interactive Dimension Switcher */}
        <div
          className="mt-2 inline-flex items-center gap-1 rounded-lg border border-white/12 bg-[#0D0A0C]/90 p-1"
          role="group"
          aria-label="Dimension atmosphere mode"
        >
          <button
            type="button"
            onClick={() => onChangeDimensionMode('hawkins')}
            className={`rounded-md px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
              dimensionMode === 'hawkins'
                ? 'bg-[#E50914] text-white'
                : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            Hawkins Lab
          </button>
          <button
            type="button"
            onClick={() => onChangeDimensionMode('upside-down')}
            className={`rounded-md px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
              dimensionMode === 'upside-down'
                ? 'bg-[#1D4ED8] text-white'
                : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            The Upside Down
          </button>
        </div>

        {/* Interactive Joyce Byers Alphabet Wall Synth Keyboard */}
        {christmasLights && (
          <div className="mt-2 hidden w-full max-w-3xl flex-col items-center gap-1.5 rounded-lg border border-white/10 bg-[#10090B]/85 px-3 py-2 sm:flex">
            <div
              className="flex flex-wrap items-center justify-center gap-0.5"
              aria-label="Interactive Hawkins alphabet wall"
            >
              {ALPHABET_WALL_LETTERS.map((letter, idx) => {
                const color = BULB_PALETTE[idx % BULB_PALETTE.length];
                const isLit =
                  sequenceLitIndex === idx ||
                  clickedBulbIndex === idx ||
                  typedIndices.includes(idx);
                return (
                  <button
                    key={letter}
                    type="button"
                    onClick={() => handleBulbClick(idx, letter)}
                    aria-label={`Signal letter ${letter}`}
                    title={`Click to chime & insert ${letter}`}
                    className="group flex w-[25px] flex-col items-center gap-1 rounded py-0.5 transition-colors hover:bg-white/5 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#E50914]"
                  >
                    <span
                      className={`h-2 w-2 rounded-full transition-all duration-150 ${
                        isLit ? 'scale-125 opacity-100' : 'opacity-40 group-hover:opacity-90'
                      }`}
                      style={{
                        backgroundColor: color,
                        boxShadow: isLit ? `0 0 12px ${color}, 0 0 22px ${color}` : 'none',
                      }}
                    />
                    <span
                      className={`font-hawkins-mono text-[10px] leading-none ${
                        isLit ? 'font-semibold text-white' : 'text-zinc-500 group-hover:text-zinc-200'
                      }`}
                    >
                      {letter}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-zinc-400">
              <Sparkles className="h-3 w-3 text-[#FF5C66]" aria-hidden="true" />
              <span className="font-hawkins-mono">Play signal:</span>
              {SIGNAL_SEQUENCES.map((seq) => (
                <button
                  key={seq.word}
                  type="button"
                  onClick={() => handleSpellSequence(seq.word)}
                  className="font-hawkins-mono rounded border border-white/10 bg-[#190E12] px-2 py-0.5 text-[10px] text-zinc-300 transition-colors hover:border-[#E50914]/60 hover:text-white"
                >
                  {seq.label}
                </button>
              ))}
              <button
                type="button"
                onClick={handleTriggerNostalgiaTheme}
                aria-label="Play nostalgic 1980s analog synth theme"
                className={`font-hawkins-mono inline-flex items-center gap-1 rounded border px-2.5 py-0.5 text-[10px] transition-colors ${
                  synthThemePlaying
                    ? 'border-[#E50914] bg-[#2B0C12] text-white shadow-[0_0_12px_rgba(229,9,20,0.45)]'
                    : 'border-[#E50914]/40 bg-[#1E0C10] text-[#FF8A91] hover:border-[#E50914] hover:text-white'
                }`}
              >
                <Music2 className="h-3 w-3" aria-hidden="true" />
                <span>80s Synth</span>
              </button>
            </div>
          </div>
        )}

        <p className="mt-2.5 max-w-xl text-base font-medium text-zinc-200 sm:text-lg">
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
          onToggleWebSearch={() => {
            onPlayUiClick();
            onToggleWebSearch();
          }}
          onSubmit={onSubmitPrompt}
          inputRef={inputRef}
          fileInputRef={fileInputRef}
          placeholder="Ask Hawkins AI, drop a classified document, or open a search vector..."
        />

        {recentConversationsCount > 0 && (
          <div className="mt-1.5 flex items-center justify-center">
            <button
              type="button"
              onClick={() => {
                onPlayUiClick();
                onResumeLatestChat();
              }}
              className="font-hawkins-mono text-xs text-zinc-400 underline decoration-white/20 underline-offset-4 transition-colors hover:text-[#FF5C66] hover:decoration-[#E50914]/60"
            >
              Resume previous transmission ({recentConversationsCount} saved)
            </button>
          </div>
        )}
      </div>

      {/* Quick Action Cards (6 requested capabilities) */}
      <section aria-label="Quick actions" className="mt-3 w-full max-w-4xl">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_ACTIONS.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => handleCardClick(card.id)}
                className="group flex flex-col items-start rounded-xl border border-white/10 bg-[#100B0D]/88 p-3 text-left transition-all duration-200 hover:border-[#E50914]/55 hover:bg-[#190C10]/95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E50914]"
              >
                <div className="mb-1.5 flex w-full items-center justify-between">
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
                <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">
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
