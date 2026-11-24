import { Download, Image as ImageIcon, Loader2, MessageSquarePlus, Sparkles } from 'lucide-react';
import { useState } from 'react';
import type { VisualAssetResult } from '../types/app';
import { sanitizeSvgMarkup } from '../utils/labLogic';

interface VisualLabWorkspaceProps {
  onSendVisualToChat: (visual: VisualAssetResult) => void;
  onAddUsage: (usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number }) => void;
}

const STYLE_PRESETS = [
  'Upside Down Horror',
  'Hawkins Lab Blueprint',
  '1980s Retro Poster',
  'Alphabet Wall Neon',
];

export function VisualLabWorkspace({
  onSendVisualToChat,
  onAddUsage,
}: VisualLabWorkspaceProps) {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '1:1' | '3:4'>('16:9');
  const [style, setStyle] = useState(STYLE_PRESETS[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gallery, setGallery] = useState<VisualAssetResult[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const activeAsset = gallery.find((g) => g.id === selectedId) ?? gallery[0] ?? null;

  const handleGenerate = async (overridePrompt?: string) => {
    const target = (overridePrompt ?? prompt).trim();
    if (!target || isGenerating) return;

    setIsGenerating(true);
    setError(null);

    try {
      const resp = await fetch('/api/generate-visual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: target, aspectRatio, style }),
      });

      const data = (await resp.json()) as {
        title?: string;
        description?: string;
        palette?: string[];
        svgMarkup?: string;
        usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
        error?: string;
      };

      if (!resp.ok || !data.svgMarkup) {
        throw new Error(data.error || 'Visual synthesis failed.');
      }

      const cleanSvg = sanitizeSvgMarkup(data.svgMarkup);
      if (!cleanSvg) {
        throw new Error('Returned artwork was not valid SVG.');
      }

      const result: VisualAssetResult = {
        id: `vis-${Date.now()}`,
        prompt: target,
        aspectRatio,
        style,
        title: data.title || 'Hawkins Visual Synthesis',
        description: data.description || target,
        svgMarkup: cleanSvg,
        palette: data.palette || ['#080808', '#E50914'],
        createdAt: Date.now(),
      };

      if (data.usage) {
        onAddUsage(data.usage);
      }

      setGallery((prev) => [result, ...prev]);
      setSelectedId(result.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate visual.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadSvg = () => {
    if (!activeAsset) return;
    const blob = new Blob([activeAsset.svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hawkins-visual-${activeAsset.id}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPng = () => {
    if (!activeAsset) return;
    const svgBlob = new Blob([activeAsset.svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const dims =
        activeAsset.aspectRatio === '1:1'
          ? { w: 1024, h: 1024 }
          : activeAsset.aspectRatio === '3:4'
            ? { w: 900, h: 1200 }
            : { w: 1280, h: 720 };
      const canvas = document.createElement('canvas');
      canvas.width = dims.w;
      canvas.height = dims.h;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#080808';
        ctx.fillRect(0, 0, dims.w, dims.h);
        ctx.drawImage(img, 0, 0, dims.w, dims.h);
        const pngUrl = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = `hawkins-visual-${activeAsset.id}.png`;
        a.click();
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  return (
    <main className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6">
      <div className="grid flex-1 grid-cols-1 items-stretch gap-5 lg:grid-cols-12">
        {/* Controls Column */}
        <section className="flex flex-col gap-4 rounded-xl border border-white/12 bg-[#0D090B]/95 p-5 lg:col-span-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium tracking-[0.18em] text-[#FF5C66] uppercase">
              <ImageIcon className="h-4 w-4" aria-hidden="true" />
              <span>Hawkins Visual Synthesis</span>
            </div>
            <h1 className="font-hawkins-display mt-1.5 text-2xl font-bold text-white">
              Vector & Poster Lab
            </h1>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">
              Synthesize custom vector illustrations, 1980s retro posters, and schematic diagrams
              powered by Gemini 4 Hydrogen, exportable as SVG or PNG.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleGenerate();
            }}
            className="flex flex-col gap-4"
          >
            <div>
              <label
                htmlFor="visual-prompt"
                className="mb-1.5 block text-xs font-medium text-zinc-300"
              >
                Visual Directive
              </label>
              <textarea
                id="visual-prompt"
                rows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe a scene or diagram (e.g., A glowing crimson rift opening inside a dark 1980s pine forest with silhouettes and lightning)..."
                className="w-full rounded-lg border border-white/15 bg-[#08080A] p-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-[#E50914] focus:outline-none"
              />
            </div>

            <div>
              <span className="mb-1.5 block text-xs font-medium text-zinc-300">Aspect Ratio</span>
              <div className="grid grid-cols-3 gap-2">
                {(['16:9', '1:1', '3:4'] as const).map((ratio) => (
                  <button
                    key={ratio}
                    type="button"
                    onClick={() => setAspectRatio(ratio)}
                    className={`font-hawkins-mono h-9 rounded-md border text-xs font-medium transition-colors ${
                      aspectRatio === ratio
                        ? 'border-[#E50914] bg-[#240A0D] text-white'
                        : 'border-white/12 bg-[#140D10] text-zinc-400 hover:text-zinc-100'
                    }`}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label
                htmlFor="visual-style"
                className="mb-1.5 block text-xs font-medium text-zinc-300"
              >
                Aesthetic Preset
              </label>
              <select
                id="visual-style"
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="h-10 w-full rounded-lg border border-white/15 bg-[#08080A] px-3 text-sm text-zinc-200 focus:border-[#E50914] focus:outline-none"
              >
                {STYLE_PRESETS.map((preset) => (
                  <option key={preset} value={preset} className="bg-[#08080A]">
                    {preset}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={!prompt.trim() || isGenerating}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#E50914] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#FF1A26] disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Synthesizing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Generate Visual</span>
                </>
              )}
            </button>
          </form>

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-[#E50914]/50 bg-[#240A0D] p-3 text-xs text-[#FF9CA2]"
            >
              {error}
            </div>
          )}

          <div className="mt-auto border-t border-white/10 pt-3 text-xs text-zinc-500">
            Raster diffusion models require a billing-enabled Gemini API key in Settings &gt;
            Secrets. Vector synthesis runs directly on the active free-tier key.
          </div>
        </section>

        {/* Preview Stage */}
        <section className="flex flex-col rounded-xl border border-white/12 bg-[#0D090B]/95 p-5 lg:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div>
              <h2 className="font-hawkins-display text-lg font-bold text-white">
                {activeAsset ? activeAsset.title : 'Synthesis Viewport'}
              </h2>
              <p className="text-xs text-zinc-400">
                {activeAsset
                  ? activeAsset.description
                  : 'Generated artwork renders cleanly at native resolution.'}
              </p>
            </div>

            {activeAsset && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadSvg}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/12 bg-[#160E11] px-3 text-xs font-medium text-zinc-200 hover:border-white/30 hover:text-white"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>SVG</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPng}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/12 bg-[#160E11] px-3 text-xs font-medium text-zinc-200 hover:border-white/30 hover:text-white"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>PNG</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSendVisualToChat(activeAsset)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#E50914] px-3 text-xs font-semibold text-white hover:bg-[#FF1A26]"
                >
                  <MessageSquarePlus className="h-3.5 w-3.5" />
                  <span>Discuss in Chat</span>
                </button>
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-1 flex-col items-center justify-center rounded-lg border border-white/10 bg-[#060608] p-4">
            {isGenerating ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-[#E50914]" />
                <p className="text-sm text-zinc-300">Rendering layered SVG geometry...</p>
              </div>
            ) : activeAsset ? (
              <div
                className="w-full max-w-2xl overflow-hidden rounded-lg border border-white/10 bg-[#080808]"
                dangerouslySetInnerHTML={{ __html: activeAsset.svgMarkup }}
              />
            ) : (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <ImageIcon className="h-9 w-9 text-zinc-600" />
                <p className="max-w-sm text-sm text-zinc-400">
                  Enter a prompt on the left or try a preset below to synthesize custom artwork.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {[
                    'Crimson Upside Down rift in a dark pine forest',
                    'Hawkins Laboratory underground radar schematic',
                    'Retro 1980s neon cassette tape floating in fog',
                  ].map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => {
                        setPrompt(example);
                        void handleGenerate(example);
                      }}
                      className="rounded-md border border-white/10 bg-[#140D10] px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:border-[#E50914]/50 hover:text-white"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {gallery.length > 1 && (
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {gallery.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={`shrink-0 rounded-md border px-3 py-1.5 text-xs transition-colors ${
                    item.id === activeAsset?.id
                      ? 'border-[#E50914] bg-[#240A0D] text-white'
                      : 'border-white/10 bg-[#140D10] text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {item.title}
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
