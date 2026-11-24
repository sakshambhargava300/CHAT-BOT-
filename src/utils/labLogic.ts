import type {
  Conversation,
  LabSettings,
  ModelId,
  PersonaPreset,
  ResearchStageStatus,
  TokenUsageStats,
} from '../types/app';

export interface ModelMetadata {
  id: ModelId;
  label: string;
  shortLabel: string;
  contextWindow: number;
  maxOutputLimit: number;
  supportsSamplingParams: boolean;
  supportsThinkingLevel: boolean;
  tierLabel: string;
  description: string;
}

export const MODEL_CATALOG: Record<ModelId, ModelMetadata> = {
  'gemini-4-hydrogen': {
    id: 'gemini-4-hydrogen',
    label: 'Gemini 4 Hydrogen',
    shortLabel: 'Gemini 4 H',
    contextWindow: 1048576,
    maxOutputLimit: 65536,
    supportsSamplingParams: false,
    supportsThinkingLevel: true,
    tierLabel: 'Reasoning & Multimodal',
    description:
      'Primary Hawkins terminal engine with adaptive thinking depth, Google Search grounding, and multimodal document comprehension.',
  },
  'gemini-3.1-flash-lite': {
    id: 'gemini-3.1-flash-lite',
    label: 'Gemini 3.1 Flash Lite',
    shortLabel: 'Flash 3.1 Lite',
    contextWindow: 1048576,
    maxOutputLimit: 32768,
    supportsSamplingParams: true,
    supportsThinkingLevel: false,
    tierLabel: 'Low-Latency Tunable',
    description:
      'High-speed laboratory channel supporting explicit Temperature, Top-P, and Top-K sampling controls.',
  },
};

export const DEFAULT_LAB_SETTINGS: LabSettings = {
  model: 'gemini-4-hydrogen',
  provider: 'google-gemini',
  thinkingLevel: 'HIGH',
  maxOutputTokens: 8192,
  temperature: 0.7,
  topP: 0.95,
  topK: 40,
  streaming: true,
  webSearch: false,
  reducedMotion: false,
  crtScanlines: true,
  christmasLights: true,
  ambientSoundMuted: false,
  ambientVolume: 0.45,
  uiSoundsEnabled: true,
  nostalgiaSynthEnabled: true,
  dimensionMode: 'hawkins',
  persona: 'hawkins',
  ttsVoice: 'Charon',
};

export const DEFAULT_TOKEN_STATS: TokenUsageStats = {
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
  requestCount: 0,
};

export const ALPHABET_WALL_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// C minor / Stranger Things iconic arpeggio intervals (Hz) across 26 bulbs
const HAWKINS_ARP_SCALE = [
  130.81, 155.56, 196.0, 246.94, 261.63, 311.13, 392.0, 493.88, 523.25,
];

export const NOSTALGIA_ARP_STEP_MS = 172;

export interface NostalgiaArpNote {
  letter: 'C' | 'E' | 'G' | 'B';
  letterIndex: number;
  freq: number;
}

// Iconic 1980s analog synth 8-step up-and-down Cmaj7 ostinato (C3-E3-G3-B3-C4-B3-G3-E3)
export const NOSTALGIA_ARP_NOTES: NostalgiaArpNote[] = [
  { letter: 'C', letterIndex: 2, freq: 130.81 },
  { letter: 'E', letterIndex: 4, freq: 164.81 },
  { letter: 'G', letterIndex: 6, freq: 196.0 },
  { letter: 'B', letterIndex: 1, freq: 246.94 },
  { letter: 'C', letterIndex: 2, freq: 261.63 },
  { letter: 'B', letterIndex: 1, freq: 246.94 },
  { letter: 'G', letterIndex: 6, freq: 196.0 },
  { letter: 'E', letterIndex: 4, freq: 164.81 },
];

export interface TimedArpStep extends NostalgiaArpNote {
  stepIndex: number;
  delayMs: number;
}

export function getNostalgiaArpPattern(cycles = 3): TimedArpStep[] {
  const safeCycles = Math.max(1, Math.min(8, Math.floor(cycles)));
  const steps: TimedArpStep[] = [];
  for (let c = 0; c < safeCycles; c += 1) {
    for (let i = 0; i < NOSTALGIA_ARP_NOTES.length; i += 1) {
      const stepIndex = c * NOSTALGIA_ARP_NOTES.length + i;
      steps.push({
        ...NOSTALGIA_ARP_NOTES[i],
        stepIndex,
        delayMs: stepIndex * NOSTALGIA_ARP_STEP_MS,
      });
    }
  }
  return steps;
}

export function getSynthFrequencyForLetter(index: number): number {
  const safeIdx = Math.abs(Math.floor(index)) % HAWKINS_ARP_SCALE.length;
  return HAWKINS_ARP_SCALE[safeIdx];
}

export function isSamplingSupported(modelId: ModelId): boolean {
  return MODEL_CATALOG[modelId]?.supportsSamplingParams ?? false;
}

export function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function computeEffectiveAmbientGain(muted: boolean, volume: number): number {
  if (muted) return 0;
  return Number((clampNumber(volume, 0, 1) * 0.32).toFixed(4));
}

export function sanitizeLabSettings(input: Partial<LabSettings>): LabSettings {
  const model: ModelId =
    input.model && input.model in MODEL_CATALOG ? input.model : DEFAULT_LAB_SETTINGS.model;
  const meta = MODEL_CATALOG[model];
  const dimensionMode = input.dimensionMode === 'upside-down' ? 'upside-down' : 'hawkins';

  return {
    ...DEFAULT_LAB_SETTINGS,
    ...input,
    model,
    dimensionMode,
    maxOutputTokens: Math.round(
      clampNumber(
        input.maxOutputTokens ?? DEFAULT_LAB_SETTINGS.maxOutputTokens,
        256,
        meta.maxOutputLimit
      )
    ),
    temperature: Number(clampNumber(input.temperature ?? 0.7, 0, 2).toFixed(2)),
    topP: Number(clampNumber(input.topP ?? 0.95, 0.05, 1).toFixed(2)),
    topK: Math.round(clampNumber(input.topK ?? 40, 1, 64)),
    ambientVolume: Number(
      clampNumber(input.ambientVolume ?? DEFAULT_LAB_SETTINGS.ambientVolume, 0.05, 1).toFixed(2)
    ),
  };
}

export function buildSystemInstruction(persona: PersonaPreset, maxOutputTokens: number): string {
  const lengthHint =
    maxOutputTokens <= 1024
      ? 'Keep responses crisp and concise.'
      : maxOutputTokens <= 4096
        ? 'Provide thorough, well-structured answers.'
        : 'Provide comprehensive, deep technical and analytical detail when warranted.';

  switch (persona) {
    case 'coding':
      return `You are the Hawkins National Laboratory Systems & Coding Terminal. Deliver clean, production-grade TypeScript, Python, systems code, and root-cause debugging with clear Markdown code blocks and concise architectural rationale. ${lengthHint}`;
    case 'analyst':
      return `You are the Hawkins Classified Document & Intelligence Analyst. Examine uploaded documents, images, logs, and datasets with empirical precision. Quote exact evidence, flag anomalies, and summarize structured findings cleanly in Markdown. ${lengthHint}`;
    case 'researcher':
      return `You are Project Indigo's Lead Researcher at Hawkins Laboratory. Synthesize verified findings with explicit citations, structured comparisons, and transparent confidence levels. ${lengthHint}`;
    case 'hawkins':
    default:
      return `You are STRANGER THINGS AI, the intelligence terminal inside Hawkins National Laboratory (1980s Indiana). Be accurate, helpful, incisive, and clear. Use clean Markdown formatting for explanations, lists, and code blocks. Maintain subtle atmospheric poise without obscuring factual precision. ${lengthHint}`;
  }
}

export function estimateTokenCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return Math.max(1, Math.ceil(trimmed.length / 4));
}

export function estimateConversationTokens(conversation: Conversation | null): number {
  if (!conversation) return 0;
  return conversation.messages.reduce(
    (sum, msg) => sum + estimateTokenCount(msg.content) + (msg.attachments?.length ? 256 : 0),
    0
  );
}

export function accumulateTokenUsage(
  prev: TokenUsageStats,
  delta: { promptTokens?: number; completionTokens?: number; totalTokens?: number }
): TokenUsageStats {
  const prompt = Math.max(0, delta.promptTokens ?? 0);
  const completion = Math.max(0, delta.completionTokens ?? 0);
  const total = Math.max(prompt + completion, delta.totalTokens ?? 0);

  return {
    promptTokens: prev.promptTokens + prompt,
    completionTokens: prev.completionTokens + completion,
    totalTokens: prev.totalTokens + total,
    requestCount: prev.requestCount + 1,
  };
}

export function createConversationTitle(firstPrompt: string): string {
  const cleaned = firstPrompt.replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'Untitled Transmission';
  if (cleaned.length <= 46) return cleaned;
  return `${cleaned.slice(0, 43).trimEnd()}...`;
}

export function createInitialResearchStages(): ResearchStageStatus[] {
  return [
    {
      id: 'calibrating',
      label: 'Gate Calibration',
      detail: 'Decomposing query into targeted search vectors',
      status: 'pending',
    },
    {
      id: 'collecting',
      label: 'Source Collection',
      detail: 'Executing live Google Search grounding sweeps',
      status: 'pending',
    },
    {
      id: 'analyzing',
      label: 'Cross-Reference Analysis',
      detail: 'Corroborating claims and filtering anomalies',
      status: 'pending',
    },
    {
      id: 'synthesizing',
      label: 'Report Synthesis',
      detail: 'Compiling classified dossier with verified citations',
      status: 'pending',
    },
  ];
}

export function getActiveAlphabetIndices(text: string): number[] {
  const upper = text.toUpperCase();
  const seen = new Set<number>();
  for (let i = upper.length - 1; i >= 0 && seen.size < 4; i -= 1) {
    const code = upper.charCodeAt(i);
    if (code >= 65 && code <= 90) {
      seen.add(code - 65);
    }
  }
  return Array.from(seen);
}

export function parseSseLine(rawLine: string): { event?: string; data?: string } | null {
  const line = rawLine.trimEnd();
  if (!line) return null;
  if (line.startsWith('event:')) {
    return { event: line.slice(6).trim() };
  }
  if (line.startsWith('data:')) {
    return { data: line.slice(5).trim() };
  }
  return null;
}

export function sanitizeSvgMarkup(svg: string): string {
  const trimmed = svg.trim();
  if (!trimmed.toLowerCase().includes('<svg')) {
    return '';
  }
  // Strip any script tags or inline event handlers for strict safety
  return trimmed
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(['"])[\s\S]*?\1/gi, '')
    .replace(/javascript:/gi, '');
}
