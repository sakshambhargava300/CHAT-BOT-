import { Cpu, Gauge, RotateCcw, Server, ShieldCheck, Sliders, X } from 'lucide-react';
import type {
  LabSettings,
  ModelId,
  PersonaPreset,
  ServerHealthStatus,
  ThinkingLevelOption,
  TokenUsageStats,
} from '../types/app';
import { isSamplingSupported, MODEL_CATALOG } from '../utils/labLogic';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  settings: LabSettings;
  onUpdateSettings: (patch: Partial<LabSettings>) => void;
  tokenStats: TokenUsageStats;
  onResetTokenStats: () => void;
  activeContextTokens: number;
  health: ServerHealthStatus;
  onRefreshHealth: () => void;
  onPlayNostalgiaTheme: () => void;
}

export function SettingsModal({
  open,
  onClose,
  settings,
  onUpdateSettings,
  tokenStats,
  onResetTokenStats,
  activeContextTokens,
  health,
  onRefreshHealth,
  onPlayNostalgiaTheme,
}: SettingsModalProps) {
  if (!open) return null;

  const modelMeta = MODEL_CATALOG[settings.model];
  const samplingSupported = isSamplingSupported(settings.model);
  const contextPercent = Math.min(
    100,
    Math.round((activeContextTokens / modelMeta.contextWindow) * 10000) / 100
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="hawkins-settings-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-[#E50914]/40 bg-[#0B090A] shadow-[0_0_50px_rgba(229,9,20,0.2)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 bg-[#140A0D] px-6 py-4">
          <div>
            <div className="font-hawkins-mono text-[11px] tracking-[0.2em] text-[#FF5C66] uppercase">
              Hawkins Laboratory Computer
            </div>
            <h2
              id="hawkins-settings-title"
              className="font-hawkins-display mt-0.5 text-xl font-bold text-white"
            >
              System & Token Controls
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings panel"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/15 bg-[#0D090A] text-zinc-300 transition-colors hover:border-[#E50914] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Control Body */}
        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {/* 1. AI Model Selection */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Cpu className="h-4 w-4 text-[#FF5C66]" aria-hidden="true" />
              <h3>AI Model Selection</h3>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {Object.values(MODEL_CATALOG).map((m) => {
                const selected = settings.model === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() =>
                      onUpdateSettings({
                        model: m.id as ModelId,
                        maxOutputTokens: Math.min(settings.maxOutputTokens, m.maxOutputLimit),
                      })
                    }
                    className={`rounded-lg border p-3.5 text-left transition-colors ${
                      selected
                        ? 'border-[#E50914] bg-[#240A0D]/80'
                        : 'border-white/12 bg-[#120D10] hover:border-white/25'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-white">{m.label}</span>
                      <span className="font-hawkins-mono text-[11px] text-[#FF7A82]">
                        {m.tierLabel}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">{m.description}</p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 2. Provider & API Configuration (Server-Proxy Architecture) */}
          <section className="space-y-3 border-t border-white/10 pt-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Server className="h-4 w-4 text-[#FF5C66]" aria-hidden="true" />
                <h3>Provider & API Configuration</h3>
              </div>
              <button
                type="button"
                onClick={onRefreshHealth}
                className="font-hawkins-mono rounded border border-white/15 bg-[#150E11] px-2.5 py-1 text-[11px] text-zinc-300 hover:border-white/30 hover:text-white"
              >
                Verify Connection
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-white/10 bg-[#120D10] p-3">
                <div className="text-[11px] text-zinc-400">Active Provider</div>
                <select
                  aria-label="Provider selection"
                  value={settings.provider}
                  onChange={(e) =>
                    onUpdateSettings({ provider: e.target.value as 'google-gemini' })
                  }
                  className="mt-1 w-full rounded border border-white/10 bg-[#08080A] px-2 py-1.5 text-xs text-zinc-100 focus:border-[#E50914] focus:outline-none"
                >
                  <option value="google-gemini">Google Gemini (Server Proxy)</option>
                </select>
              </div>

              <div className="rounded-lg border border-white/10 bg-[#120D10] p-3">
                <div className="text-[11px] text-zinc-400">Backend Endpoint</div>
                <div className="font-hawkins-mono mt-1.5 text-xs text-zinc-100">
                  {health.endpoint}
                </div>
                <div className="mt-1 text-[11px] text-zinc-500">
                  Server-managed credentials
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-[#120D10] p-3">
                <div className="text-[11px] text-zinc-400">Gate Key Status</div>
                <div className="mt-1.5 flex items-center gap-1.5 text-xs font-medium">
                  <ShieldCheck
                    className={`h-4 w-4 ${
                      health.apiKeyConfigured ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  />
                  <span className={health.apiKeyConfigured ? 'text-emerald-300' : 'text-amber-300'}>
                    {health.apiKeyConfigured ? 'Configured in Secrets' : 'Not Detected'}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-white/10 bg-[#120D10] p-3">
                <label
                  htmlFor="settings-persona"
                  className="block text-xs font-medium text-zinc-300"
                >
                  Terminal Persona Preset
                </label>
                <select
                  id="settings-persona"
                  value={settings.persona}
                  onChange={(e) =>
                    onUpdateSettings({ persona: e.target.value as PersonaPreset })
                  }
                  className="mt-1.5 h-9 w-full rounded border border-white/12 bg-[#08080A] px-2.5 text-xs text-zinc-100 focus:border-[#E50914] focus:outline-none"
                >
                  <option value="hawkins">Hawkins Terminal (Balanced)</option>
                  <option value="coding">Coding Lab (Systems & Code)</option>
                  <option value="analyst">Document Analyst (Empirical)</option>
                  <option value="researcher">Project Indigo Researcher</option>
                </select>
              </div>

              <div className="rounded-lg border border-white/10 bg-[#120D10] p-3">
                <label
                  htmlFor="settings-tts-voice"
                  className="block text-xs font-medium text-zinc-300"
                >
                  Voice Synthesis Persona
                </label>
                <select
                  id="settings-tts-voice"
                  value={settings.ttsVoice}
                  onChange={(e) =>
                    onUpdateSettings({
                      ttsVoice: e.target.value as LabSettings['ttsVoice'],
                    })
                  }
                  className="mt-1.5 h-9 w-full rounded border border-white/12 bg-[#08080A] px-2.5 text-xs text-zinc-100 focus:border-[#E50914] focus:outline-none"
                >
                  <option value="Charon">Charon (Deep Lab Narrator)</option>
                  <option value="Kore">Kore (Clear Broadcast)</option>
                  <option value="Fenrir">Fenrir (Dramatic Low)</option>
                  <option value="Puck">Puck (Bright Conversational)</option>
                  <option value="Zephyr">Zephyr (Calm Analytical)</option>
                </select>
              </div>
            </div>
          </section>

          {/* 3. Context Window & Token Parameters */}
          <section className="space-y-4 border-t border-white/10 pt-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Sliders className="h-4 w-4 text-[#FF5C66]" aria-hidden="true" />
              <h3>Context Window & Generation Parameters</h3>
            </div>

            {/* Context Window Info Bar */}
            <div className="rounded-lg border border-white/10 bg-[#120D10] p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-zinc-300">
                  Context Window Capacity:{' '}
                  <strong className="font-hawkins-mono text-white">
                    {modelMeta.contextWindow.toLocaleString()} tokens
                  </strong>
                </span>
                <span className="font-hawkins-mono text-zinc-400">
                  Active Thread: {activeContextTokens.toLocaleString()} ({contextPercent}%)
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full bg-[#E50914] transition-all"
                  style={{ width: `${Math.max(contextPercent, activeContextTokens > 0 ? 1 : 0)}%` }}
                />
              </div>
            </div>

            {/* Thinking Level (for Gemini 4 Hydrogen) */}
            {modelMeta.supportsThinkingLevel && (
              <div className="rounded-lg border border-white/10 bg-[#120D10] p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-200">
                    Reasoning Depth (Thinking Level)
                  </span>
                  <span className="font-hawkins-mono text-xs text-[#FF7A82]">
                    {settings.thinkingLevel}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {(['LOW', 'MEDIUM', 'HIGH', 'XHIGH'] as ThinkingLevelOption[]).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => onUpdateSettings({ thinkingLevel: lvl })}
                      className={`font-hawkins-mono h-8 rounded border text-xs transition-colors ${
                        settings.thinkingLevel === lvl
                          ? 'border-[#E50914] bg-[#240A0D] text-white'
                          : 'border-white/10 bg-[#0A0809] text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Max Output Tokens Slider */}
            <div className="rounded-lg border border-white/10 bg-[#120D10] p-3.5">
              <div className="flex items-center justify-between">
                <label htmlFor="slider-max-tokens" className="text-xs font-medium text-zinc-200">
                  Maximum Output Tokens
                </label>
                <span className="font-hawkins-mono text-xs font-semibold text-white">
                  {settings.maxOutputTokens.toLocaleString()} /{' '}
                  {modelMeta.maxOutputLimit.toLocaleString()}
                </span>
              </div>
              <input
                id="slider-max-tokens"
                type="range"
                min={256}
                max={modelMeta.maxOutputLimit}
                step={256}
                value={settings.maxOutputTokens}
                onChange={(e) =>
                  onUpdateSettings({ maxOutputTokens: Number(e.target.value) })
                }
                className="mt-2 w-full accent-[#E50914]"
              />
            </div>

            {/* Temperature, Top-P, Top-K */}
            <div className="rounded-lg border border-white/10 bg-[#120D10] p-3.5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-zinc-200">Sampling Controls</span>
                <span className="font-hawkins-mono text-[11px] text-zinc-400">
                  {samplingSupported
                    ? 'Active for Gemini 3.1 Flash Lite'
                    : 'Auto-managed by Gemini 4 reasoning engine'}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <div className="flex justify-between text-xs">
                    <label htmlFor="slider-temp" className="text-zinc-300">
                      Temperature
                    </label>
                    <span className="font-hawkins-mono text-zinc-200">
                      {settings.temperature.toFixed(2)}
                    </span>
                  </div>
                  <input
                    id="slider-temp"
                    type="range"
                    min={0}
                    max={2}
                    step={0.05}
                    disabled={!samplingSupported}
                    value={settings.temperature}
                    onChange={(e) =>
                      onUpdateSettings({ temperature: Number(e.target.value) })
                    }
                    className="mt-1.5 w-full accent-[#E50914] disabled:opacity-40"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs">
                    <label htmlFor="slider-top-p" className="text-zinc-300">
                      Top-P
                    </label>
                    <span className="font-hawkins-mono text-zinc-200">
                      {settings.topP.toFixed(2)}
                    </span>
                  </div>
                  <input
                    id="slider-top-p"
                    type="range"
                    min={0.05}
                    max={1}
                    step={0.05}
                    disabled={!samplingSupported}
                    value={settings.topP}
                    onChange={(e) => onUpdateSettings({ topP: Number(e.target.value) })}
                    className="mt-1.5 w-full accent-[#E50914] disabled:opacity-40"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs">
                    <label htmlFor="slider-top-k" className="text-zinc-300">
                      Top-K
                    </label>
                    <span className="font-hawkins-mono text-zinc-200">{settings.topK}</span>
                  </div>
                  <input
                    id="slider-top-k"
                    type="range"
                    min={1}
                    max={64}
                    step={1}
                    disabled={!samplingSupported}
                    value={settings.topK}
                    onChange={(e) => onUpdateSettings({ topK: Number(e.target.value) })}
                    className="mt-1.5 w-full accent-[#E50914] disabled:opacity-40"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* 4. Token Usage Statistics */}
          <section className="space-y-3 border-t border-white/10 pt-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Gauge className="h-4 w-4 text-[#FF5C66]" aria-hidden="true" />
                <h3>Token Usage Statistics</h3>
              </div>
              <button
                type="button"
                onClick={onResetTokenStats}
                className="inline-flex items-center gap-1 rounded border border-white/12 bg-[#150E11] px-2.5 py-1 text-xs text-zinc-300 hover:border-white/25 hover:text-white"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reset Stats</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {[
                { label: 'Prompt Tokens', value: tokenStats.promptTokens },
                { label: 'Output Tokens', value: tokenStats.completionTokens },
                { label: 'Total Tokens', value: tokenStats.totalTokens },
                { label: 'Transmissions', value: tokenStats.requestCount },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-lg border border-white/10 bg-[#120D10] p-3"
                >
                  <div className="text-[11px] text-zinc-400">{stat.label}</div>
                  <div className="font-hawkins-mono mt-1 text-lg font-semibold text-white">
                    {stat.value.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 5. Behavior & Visual Toggles */}
          <section className="space-y-2.5 border-t border-white/10 pt-5">
            <h3 className="text-sm font-semibold text-white">Terminal & Atmospheric Switches</h3>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {[
                {
                  key: 'streaming' as const,
                  label: 'Streaming Responses',
                  desc: 'Display tokens live via Server-Sent Events',
                },
                {
                  key: 'webSearch' as const,
                  label: 'Web Search Grounding',
                  desc: 'Ground answers with live Google Search citations',
                },
                {
                  key: 'reducedMotion' as const,
                  label: 'Reduced Motion',
                  desc: 'Pause spores, lightning, glitch, and fog drift',
                },
                {
                  key: 'crtScanlines' as const,
                  label: '1980s CRT Scanlines',
                  desc: 'Subtle laboratory cathode-ray overlay',
                },
                {
                  key: 'christmasLights' as const,
                  label: 'Alphabet Wall Lights',
                  desc: 'Show interactive Christmas bulb signal strip',
                },
                {
                  key: 'ambientSoundMuted' as const,
                  label: 'Mute Upside Down Soundscape',
                  desc: 'Silence ambient rumbles, crackling, and distant echoes',
                },
                {
                  key: 'uiSoundsEnabled' as const,
                  label: 'Hawkins UI Sound Effects',
                  desc: 'Tactile terminal clicks, synth wall chimes, and gate tones',
                },
                {
                  key: 'nostalgiaSynthEnabled' as const,
                  label: 'Nostalgic 80s Synth Theme',
                  desc: 'Analog Cmaj7 shimmer swells in ambient soundscape',
                },
              ].map((toggle) => {
                const checked = settings[toggle.key];
                return (
                  <label
                    key={toggle.key}
                    className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-white/10 bg-[#120D10] p-3 transition-colors hover:border-white/25"
                  >
                    <div>
                      <div className="text-xs font-medium text-zinc-100">{toggle.label}</div>
                      <div className="text-[11px] text-zinc-400">{toggle.desc}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        onUpdateSettings({ [toggle.key]: e.target.checked })
                      }
                      className="h-4 w-4 accent-[#E50914]"
                    />
                  </label>
                );
              })}

              <div className="rounded-lg border border-white/10 bg-[#120D10] p-3 sm:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor="slider-ambient-volume" className="text-xs font-medium text-zinc-100">
                    Ambient Soundscape & Synth Level
                  </label>
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      disabled={settings.ambientSoundMuted}
                      onClick={onPlayNostalgiaTheme}
                      className="font-hawkins-mono rounded border border-[#E50914]/45 bg-[#240A0D] px-2.5 py-0.5 text-[11px] text-[#FF8A91] transition-colors hover:border-[#E50914] hover:text-white disabled:opacity-40"
                    >
                      Preview 80s Synth
                    </button>
                    <span className="font-hawkins-mono text-xs text-zinc-300">
                      {settings.ambientSoundMuted
                        ? 'Muted'
                        : `${Math.round(settings.ambientVolume * 100)}%`}
                    </span>
                  </div>
                </div>
                <input
                  id="slider-ambient-volume"
                  type="range"
                  min={0.05}
                  max={1}
                  step={0.05}
                  disabled={settings.ambientSoundMuted}
                  value={settings.ambientVolume}
                  onChange={(e) =>
                    onUpdateSettings({ ambientVolume: Number(e.target.value) })
                  }
                  className="mt-2 w-full accent-[#E50914] disabled:opacity-40"
                />
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-white/10 bg-[#120A0C] px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-md bg-[#E50914] px-5 text-xs font-semibold text-white transition-colors hover:bg-[#FF1A26]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
