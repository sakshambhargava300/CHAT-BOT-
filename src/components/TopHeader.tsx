import { Menu, Radio, Settings2, SlidersHorizontal, Volume2, VolumeX } from 'lucide-react';
import type { AppWorkspace, ModelId, ServerHealthStatus } from '../types/app';
import { MODEL_CATALOG } from '../utils/labLogic';

interface TopHeaderProps {
  workspace: AppWorkspace;
  onNavigate: (workspace: AppWorkspace) => void;
  model: ModelId;
  onModelChange: (model: ModelId) => void;
  health: ServerHealthStatus;
  onRefreshHealth?: () => void;
  isBusy: boolean;
  ambientSoundMuted: boolean;
  onToggleAmbientMute: () => void;
  onOpenSettings: () => void;
  onToggleMobileSidebar?: () => void;
}

export function TopHeader({
  workspace,
  onNavigate,
  model,
  onModelChange,
  health,
  onRefreshHealth,
  isBusy,
  ambientSoundMuted,
  onToggleAmbientMute,
  onOpenSettings,
  onToggleMobileSidebar,
}: TopHeaderProps) {
  const statusText = !health.ok
    ? 'Signal Lost'
    : !health.apiKeyConfigured
      ? 'Key Missing'
      : isBusy
        ? 'Transmitting'
        : 'Gate Online';

  const statusTone = !health.ok || !health.apiKeyConfigured
    ? 'text-amber-400'
    : isBusy
      ? 'text-[#FF4D58]'
      : 'text-emerald-400';

  return (
    <header className="relative z-30 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-white/10 bg-[#080808]/95 px-4 sm:px-6">
      {/* Zone 1: Brand Title + Subtitle */}
      <div className="flex min-w-0 items-center gap-3">
        {workspace !== 'home' && onToggleMobileSidebar && (
          <button
            type="button"
            onClick={onToggleMobileSidebar}
            aria-label="Toggle conversation sidebar"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-white/10 bg-[#121012] text-zinc-300 transition-colors hover:border-[#E50914]/50 hover:text-white lg:hidden"
          >
            <Menu className="h-4 w-4" />
          </button>
        )}

        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="group flex min-w-0 flex-col text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E50914]"
        >
          <span className="font-hawkins-display truncate text-sm font-bold tracking-[0.14em] text-[#F5ECEC] transition-colors group-hover:text-[#FF4D58] sm:text-base">
            STRANGER THINGS AI
          </span>
          <span className="font-hawkins-mono truncate text-[10px] tracking-[0.22em] text-zinc-400 uppercase">
            WELCOME TO THE OTHER SIDE
          </span>
        </button>
      </div>

      {/* Zone 2: Workspace Nav Links (desktop) */}
      <nav aria-label="Primary workspaces" className="hidden items-center gap-6 md:flex">
        {(
          [
            { id: 'home', label: 'Gateway' },
            { id: 'chat', label: 'Terminal Chat' },
            { id: 'research', label: 'Deep Research' },
            { id: 'visual', label: 'Visual Lab' },
          ] as const
        ).map((item) => {
          const active = workspace === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`relative py-1 text-sm font-medium whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E50914] ${
                active ? 'text-white' : 'text-zinc-400 hover:text-zinc-100'
              }`}
            >
              {item.label}
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 -bottom-[19px] h-[2px] bg-[#E50914] shadow-[0_0_10px_#E50914]"
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: System Status, Model Selector, Ambient Audio Toggle, Settings */}
      <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
        <button
          type="button"
          onClick={onRefreshHealth}
          className="hidden items-center gap-2 rounded px-1.5 py-1 border-r border-white/10 pr-3 transition-opacity hover:opacity-85 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#E50914] sm:flex"
          title={`Provider: ${health.provider} — Click to re-verify signal`}
          aria-label={`System status: ${statusText}. Click to verify signal`}
        >
          <Radio className={`h-3.5 w-3.5 ${statusTone}`} aria-hidden="true" />
          <span className={`font-hawkins-mono text-xs whitespace-nowrap ${statusTone}`}>
            {statusText}
          </span>
        </button>

        <label className="sr-only" htmlFor="header-model-select">
          Select AI Model
        </label>
        <div className="relative flex items-center">
          <SlidersHorizontal
            className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-zinc-400"
            aria-hidden="true"
          />
          <select
            id="header-model-select"
            value={model}
            onChange={(e) => onModelChange(e.target.value as ModelId)}
            aria-label="Select AI Model"
            className="font-hawkins-mono h-9 max-w-[140px] cursor-pointer appearance-none truncate rounded-md border border-white/15 bg-[#120B0D] pr-7 pl-8 text-xs text-zinc-200 transition-colors hover:border-[#E50914]/50 focus:border-[#E50914] focus:outline-none sm:max-w-[185px]"
          >
            {Object.values(MODEL_CATALOG).map((m) => (
              <option key={m.id} value={m.id} className="bg-[#120B0D] text-zinc-100">
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={onToggleAmbientMute}
          aria-pressed={!ambientSoundMuted}
          aria-label={
            ambientSoundMuted ? 'Unmute Upside Down soundscape' : 'Mute Upside Down soundscape'
          }
          title={
            ambientSoundMuted ? 'Unmute Upside Down soundscape' : 'Mute Upside Down soundscape'
          }
          className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E50914] ${
            ambientSoundMuted
              ? 'border-white/15 bg-[#120B0D] text-zinc-500 hover:border-white/30 hover:text-zinc-300'
              : 'border-[#E50914]/40 bg-[#1B0A0D] text-[#FF7A82] hover:border-[#E50914]/70 hover:text-white'
          }`}
        >
          {ambientSoundMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>

        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Open Hawkins Lab settings"
          title="Hawkins Lab Settings & Token Controls"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/15 bg-[#120B0D] text-zinc-300 transition-colors hover:border-[#E50914]/60 hover:bg-[#240A0D] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E50914]"
        >
          <Settings2 className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
