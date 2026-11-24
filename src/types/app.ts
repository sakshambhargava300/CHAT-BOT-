export type ModelId = 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite';

export type ThinkingLevelOption = 'LOW' | 'MEDIUM' | 'HIGH' | 'XHIGH';

export type AppWorkspace = 'home' | 'chat' | 'research' | 'visual';

export type PersonaPreset = 'hawkins' | 'coding' | 'analyst' | 'researcher';

export interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  /** Base64 encoded payload without data: URL prefix */
  dataBase64: string;
  /** Optional text preview for plain-text documents */
  textPreview?: string;
}

export interface GroundingSource {
  title: string;
  url: string;
  snippet?: string;
}

export interface MessageUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
  attachments?: Attachment[];
  sources?: GroundingSource[];
  usage?: MessageUsage;
  model?: ModelId;
  error?: string;
}

export interface Conversation {
  id: string;
  title: string;
  mode: PersonaPreset;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

export interface TokenUsageStats {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  requestCount: number;
}

export interface LabSettings {
  model: ModelId;
  provider: 'google-gemini';
  thinkingLevel: ThinkingLevelOption;
  maxOutputTokens: number;
  temperature: number;
  topP: number;
  topK: number;
  streaming: boolean;
  webSearch: boolean;
  reducedMotion: boolean;
  crtScanlines: boolean;
  christmasLights: boolean;
  ambientSoundMuted: boolean;
  ambientVolume: number;
  uiSoundsEnabled: boolean;
  nostalgiaSynthEnabled: boolean;
  dimensionMode: 'hawkins' | 'upside-down';
  persona: PersonaPreset;
  ttsVoice: 'Charon' | 'Kore' | 'Fenrir' | 'Puck' | 'Zephyr';
}

export type ResearchStageId = 'calibrating' | 'collecting' | 'analyzing' | 'synthesizing';

export interface ResearchStageStatus {
  id: ResearchStageId;
  label: string;
  detail: string;
  status: 'pending' | 'active' | 'done' | 'error';
}

export interface ResearchSession {
  id: string;
  query: string;
  depth: 'standard' | 'exhaustive';
  createdAt: number;
  isRunning: boolean;
  stages: ResearchStageStatus[];
  subQueries: string[];
  sources: GroundingSource[];
  analysisNotes: string[];
  reportMarkdown: string;
  error?: string;
}

export interface VisualAssetResult {
  id: string;
  prompt: string;
  aspectRatio: '16:9' | '1:1' | '3:4';
  style: string;
  title: string;
  description: string;
  svgMarkup: string;
  palette: string[];
  createdAt: number;
}

export interface ServerHealthStatus {
  ok: boolean;
  apiKeyConfigured: boolean;
  provider: string;
  endpoint: string;
  checkedAt: number;
}
