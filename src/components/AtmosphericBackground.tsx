import { useEffect, useRef } from 'react';
import type { AppWorkspace } from '../types/app';

interface AtmosphericBackgroundProps {
  workspace: AppWorkspace;
  reducedMotion: boolean;
  crtScanlines: boolean;
  christmasLights: boolean;
  dimensionMode: 'hawkins' | 'upside-down';
}

interface Spore {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  alpha: number;
  isRed: boolean;
}

const BACKDROP_BY_WORKSPACE: Record<AppWorkspace, { src: string; alt: string; opacityClass: string }> = {
  home: {
    src: '/src/assets/images/upside_down_forest_1795492670887.jpg',
    alt: 'Dark supernatural pine forest in Hawkins with crimson storm glow',
    opacityClass: 'opacity-40',
  },
  chat: {
    src: '/src/assets/images/upside_down_forest_1795492670887.jpg',
    alt: 'Subtle dark Upside Down forest atmosphere',
    opacityClass: 'opacity-15',
  },
  research: {
    src: '/src/assets/images/hawkins_lab_gate_1795492671300.jpg',
    alt: 'Underground Hawkins National Laboratory control corridor',
    opacityClass: 'opacity-28',
  },
  visual: {
    src: '/src/assets/images/alphabet_wall_lights_1795492671841.jpg',
    alt: 'Vintage 1980s floral wallpaper illuminated by incandescent bulbs',
    opacityClass: 'opacity-24',
  },
};

export function AtmosphericBackground({
  workspace,
  reducedMotion,
  crtScanlines,
  christmasLights,
  dimensionMode,
}: AtmosphericBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointerRef = useRef<{ x: number; y: number; active: boolean }>({
    x: -9999,
    y: -9999,
    active: false,
  });
  const backdrop = BACKDROP_BY_WORKSPACE[workspace];
  const isUpsideDown = dimensionMode === 'upside-down';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReduced =
      reducedMotion ||
      (typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    const handlePointerMove = (e: PointerEvent) => {
      pointerRef.current = { x: e.clientX, y: e.clientY, active: true };
    };
    const handlePointerLeave = () => {
      pointerRef.current.active = false;
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerleave', handlePointerLeave);

    const count = prefersReduced ? 26 : isUpsideDown ? 72 : 52;
    const spores: Spore[] = Array.from({ length: count }, (_, i) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: 0.9 + Math.random() * (isUpsideDown ? 2.5 : 2.1),
      vx: (Math.random() - 0.5) * 0.28,
      vy: isUpsideDown ? 0.14 + Math.random() * 0.36 : -0.15 - Math.random() * 0.35,
      alpha: 0.18 + Math.random() * 0.44,
      isRed: isUpsideDown ? i % 7 === 0 : i % 5 === 0,
    }));

    const drawFrame = () => {
      ctx.clearRect(0, 0, width, height);
      for (const s of spores) {
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = s.isRed
          ? `rgba(229, 9, 20, ${s.alpha * 0.85})`
          : isUpsideDown
            ? `rgba(147, 197, 253, ${s.alpha * 0.72})`
            : `rgba(186, 204, 224, ${s.alpha * 0.65})`;
        ctx.fill();
      }
    };

    if (prefersReduced) {
      drawFrame();
      return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerleave', handlePointerLeave);
      };
    }

    let rafId = 0;
    let lastDraw = 0;
    const tick = (now: number) => {
      rafId = window.requestAnimationFrame(tick);
      if (document.hidden || now - lastDraw < 48) return;
      lastDraw = now;

      const ptr = pointerRef.current;
      for (const s of spores) {
        let dxPush = 0;
        let dyPush = 0;
        if (ptr.active) {
          const dx = s.x - ptr.x;
          const dy = s.y - ptr.y;
          const distSq = dx * dx + dy * dy;
          if (distSq > 4 && distSq < 18000) {
            const dist = Math.sqrt(distSq);
            const force = ((135 - dist) / 135) * 0.9;
            dxPush = (dx / dist) * force;
            dyPush = (dy / dist) * force;
          }
        }

        s.x += s.vx + Math.sin(s.y * 0.01) * 0.14 + dxPush;
        s.y += s.vy + dyPush;
        if (s.y < -10) {
          s.y = height + 10;
          s.x = Math.random() * width;
        } else if (s.y > height + 10) {
          s.y = -10;
          s.x = Math.random() * width;
        }
        if (s.x < -10) s.x = width + 10;
        if (s.x > width + 10) s.x = -10;
      }
      drawFrame();
    };

    drawFrame();
    rafId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerleave', handlePointerLeave);
    };
  }, [reducedMotion, isUpsideDown]);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#080808]"
      aria-hidden="true"
    >
      {/* Generated cinematic atmospheric backdrop */}
      <img
        src={backdrop.src}
        alt={backdrop.alt}
        referrerPolicy="no-referrer"
        className={`h-full w-full object-cover object-center transition-opacity duration-500 ${
          isUpsideDown ? 'opacity-28' : backdrop.opacityClass
        }`}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = 'none';
        }}
      />

      {/* Contrast & vignette scrim (keeps text > 4.5:1) */}
      <div
        className="absolute inset-0 transition-colors duration-500"
        style={{
          background: isUpsideDown
            ? 'radial-gradient(circle at 50% 35%, rgba(29, 78, 216, 0.28) 0%, rgba(10, 18, 36, 0.84) 55%, rgba(6, 9, 16, 0.97) 100%)'
            : 'radial-gradient(circle at 50% 35%, rgba(36, 10, 13, 0.42) 0%, rgba(8, 8, 8, 0.86) 62%, rgba(8, 8, 8, 0.98) 100%)',
        }}
      />

      {/* Slow-moving Upside Down fog layer */}
      <div
        className="animate-hawkins-fog absolute -inset-16"
        style={{
          background: isUpsideDown
            ? 'radial-gradient(ellipse at 25% 65%, rgba(96, 165, 250, 0.22) 0%, transparent 52%), radial-gradient(ellipse at 75% 30%, rgba(229, 9, 20, 0.16) 0%, transparent 48%)'
            : 'radial-gradient(ellipse at 25% 65%, rgba(29, 53, 87, 0.18) 0%, transparent 52%), radial-gradient(ellipse at 75% 30%, rgba(229, 9, 20, 0.14) 0%, transparent 48%)',
        }}
      />

      {/* Subtle distant crimson lightning flash */}
      {!reducedMotion && (
        <div
          className="animate-hawkins-lightning absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 58% 22%, rgba(229, 9, 20, 0.28) 0%, rgba(36, 10, 13, 0.1) 38%, transparent 70%)',
          }}
        />
      )}

      {/* Subtle ambient Christmas string lights along top edge on Home */}
      {christmasLights && workspace === 'home' && (
        <div className="absolute inset-x-0 top-14 flex justify-around px-8 opacity-45">
          {[
            '#E50914',
            '#F59E0B',
            '#60A5FA',
            '#E50914',
            '#34D399',
            '#F59E0B',
            '#E50914',
            '#60A5FA',
            '#F59E0B',
            '#E50914',
          ].map((color, idx) => (
            <span
              key={idx}
              className="animate-hawkins-bulb h-2 w-2 rounded-full"
              style={{
                backgroundColor: color,
                boxShadow: `0 0 12px ${color}`,
                animationDelay: `${idx * 0.45}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Floating Upside Down ash spores canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* Optional 1980s CRT scanlines */}
      {crtScanlines && <div className="crt-scanlines absolute inset-0 opacity-30" />}
    </div>
  );
}
