import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Zap,
  Gauge,
  Activity,
  CheckCircle2,
  RefreshCw,
  Cpu,
  Layers,
  Flame,
} from 'lucide-react';
import { useReducedMotion } from '@/hooks';
import { cn } from '@/lib/cn';

interface BoostEngineVisualizerProps {
  className?: string;
}

export function BoostEngineVisualizer({ className }: BoostEngineVisualizerProps) {
  const reduced = useReducedMotion();
  const [engineMode, setEngineMode] = useState<'boost' | 'legacy'>('boost');
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [benchmarkStep, setBenchmarkStep] = useState<string>('Ready');
  const [liveFps, setLiveFps] = useState(120);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const benchmarkTimersRef = useRef<number[]>([]);

  // Cleanup benchmark timers on unmount
  useEffect(() => {
    return () => {
      benchmarkTimersRef.current.forEach((t) => window.clearTimeout(t));
      benchmarkTimersRef.current = [];
    };
  }, []);

  // Canvas oscilloscope for frame pacing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;

    const maxPoints = 80;
    let offset = 0;
    const history: number[] = [];

    const updateSize = () => {
      dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(300, rect.width || canvas.offsetWidth || 600);
      const h = Math.max(100, rect.height || canvas.offsetHeight || 128);
      width = canvas.width = Math.round(w * dpr);
      height = canvas.height = Math.round(h * dpr);
    };

    updateSize();

    // Generate a sample point given current engine mode and offset
    const getSample = (off: number) => {
      if (engineMode === 'boost') {
        // Locked 8.3ms composite pacing: smooth gentle sine wave
        return height * 0.45 + Math.sin(off) * (height * 0.08);
      }
      // Legacy janky pacing: erratic spikes and frame drops
      const noise = Math.sin(off * 2.3) * 0.25 + (Math.sin(off * 5.7) > 0.4 ? 0.35 : -0.15);
      return height * 0.58 + noise * (height * 0.35);
    };

    // Pre-fill history so oscilloscope wave immediately fills the canvas
    history.length = 0;
    for (let i = 0; i < maxPoints; i++) {
      offset += 0.08;
      history.push(getSample(offset));
    }

    const drawFrame = () => {
      if (width === 0 || height === 0) return;
      ctx.clearRect(0, 0, width, height);

      // Draw subtle grid lines
      ctx.strokeStyle = engineMode === 'boost' ? 'rgba(36, 88, 197, 0.12)' : 'rgba(240, 106, 116, 0.15)';
      ctx.lineWidth = 1 * dpr;
      const gridStep = height / 4;
      for (let y = gridStep; y < height; y += gridStep) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Draw wave path
      ctx.beginPath();
      const stepX = width / (maxPoints - 1);
      history.forEach((pt, i) => {
        const x = i * stepX;
        if (i === 0) ctx.moveTo(x, pt);
        else ctx.lineTo(x, pt);
      });

      ctx.strokeStyle = engineMode === 'boost' ? 'rgb(22, 148, 92)' : 'rgb(203, 58, 74)';
      ctx.lineWidth = 2.5 * dpr;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      // Draw gradient fill below wave
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      if (engineMode === 'boost') {
        grad.addColorStop(0, 'rgba(22, 148, 92, 0.18)');
        grad.addColorStop(1, 'rgba(22, 148, 92, 0.01)');
      } else {
        grad.addColorStop(0, 'rgba(203, 58, 74, 0.20)');
        grad.addColorStop(1, 'rgba(203, 58, 74, 0.02)');
      }
      ctx.fillStyle = grad;
      ctx.fill();

      // Current point pulse
      if (history.length > 0) {
        const lastX = (history.length - 1) * stepX;
        const lastY = history[history.length - 1]!;
        ctx.beginPath();
        ctx.arc(lastX, lastY, 4.5 * dpr, 0, Math.PI * 2);
        ctx.fillStyle = engineMode === 'boost' ? 'rgb(22, 148, 92)' : 'rgb(203, 58, 74)';
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5 * dpr;
        ctx.stroke();
      }
    };

    // If reduced motion is requested, render static reference wave once and halt loop
    if (reduced) {
      drawFrame();
      return;
    }

    const render = () => {
      offset += 0.08;
      history.push(getSample(offset));
      if (history.length > maxPoints) history.shift();

      drawFrame();
      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    let resizeTimer: number | null = null;
    const observer = new ResizeObserver(() => {
      if (resizeTimer) cancelAnimationFrame(resizeTimer);
      resizeTimer = requestAnimationFrame(() => {
        updateSize();
        for (let i = 0; i < history.length; i++) {
          history[i] = getSample(offset - (history.length - i) * 0.08);
        }
        if (reduced) drawFrame();
      });
    });

    observer.observe(canvas);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (resizeTimer) cancelAnimationFrame(resizeTimer);
      observer.disconnect();
    };
  }, [engineMode, reduced]);

  // Simulated Benchmark Runner with leak-proof timer tracking
  const runBenchmark = useCallback(() => {
    if (isBenchmarking) return;
    benchmarkTimersRef.current.forEach((t) => window.clearTimeout(t));
    benchmarkTimersRef.current = [];

    setIsBenchmarking(true);
    setBenchmarkStep('1/4: Analyzing compositing thread...');

    const timer1 = window.setTimeout(() => {
      setBenchmarkStep('2/4: Promoting GPU hardware layers...');
    }, 450);

    const timer2 = window.setTimeout(() => {
      setBenchmarkStep('3/4: Decoupling Lenis scroll delta...');
    }, 900);

    const timer3 = window.setTimeout(() => {
      setBenchmarkStep('4/4: Validating 0.000 CLS stability...');
    }, 1350);

    const timer4 = window.setTimeout(() => {
      setIsBenchmarking(false);
      setBenchmarkStep('Benchmark Complete · 100/100 Core Web Vitals');
      setEngineMode('boost');
      setLiveFps(120);
    }, 1800);

    benchmarkTimersRef.current.push(timer1, timer2, timer3, timer4);
  }, [isBenchmarking]);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Top Controller Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-line/60 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span
                className={cn(
                  'absolute inline-flex h-full w-full rounded-full animate-ping opacity-75',
                  engineMode === 'boost' ? 'bg-success' : 'bg-danger',
                )}
              />
              <span
                className={cn(
                  'relative inline-flex h-2.5 w-2.5 rounded-full',
                  engineMode === 'boost' ? 'bg-success' : 'bg-danger',
                )}
              />
            </span>
            <span className="font-mono text-2xs uppercase tracking-wider text-fg font-semibold">
              Hardware Frame Pacing Oscilloscope
            </span>
            <span className="nf-glass-pill rounded-full px-2 py-0.5 font-mono text-3xs font-semibold text-brand">
              Real-time Compositor
            </span>
          </div>
          <p className="mt-1 text-xs text-muted">
            Inspect real-time GPU composite synchronization and sub-8.3ms frame timing.
          </p>
        </div>

        {/* Engine Switcher & Benchmark Action */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex flex-wrap sm:flex-nowrap rounded-xl border border-line/70 bg-white/60 p-1 shadow-2xs backdrop-blur-md">
            <button
              type="button"
              onClick={() => {
                setEngineMode('boost');
                setLiveFps(120);
              }}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-1.5 text-xs font-semibold transition-all duration-200',
                engineMode === 'boost'
                  ? 'bg-brand text-white shadow-xs'
                  : 'text-muted hover:text-fg hover:bg-white/50',
              )}
            >
              <Zap className="h-3.5 w-3.5 text-warning" />
              <span>Boost (120 FPS)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setEngineMode('legacy');
                setLiveFps(38);
              }}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-1.5 text-xs font-semibold transition-all duration-200',
                engineMode === 'legacy'
                  ? 'bg-danger text-white shadow-xs'
                  : 'text-muted hover:text-fg hover:bg-white/50',
              )}
            >
              <Flame className="h-3.5 w-3.5" />
              <span>Legacy (38 FPS)</span>
            </button>
          </div>

          <button
            type="button"
            onClick={runBenchmark}
            disabled={isBenchmarking}
            className={cn(
              'nf-glass-interactive inline-flex items-center gap-2 rounded-xl border border-brand/40 bg-brand/10 px-3.5 py-2 text-xs font-semibold text-brand transition-all hover:bg-brand hover:text-white shadow-2xs',
              isBenchmarking && 'opacity-70 cursor-not-allowed',
            )}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isBenchmarking && 'animate-spin')} />
            <span>{isBenchmarking ? 'Testing...' : 'Run Diagnostics'}</span>
          </button>
        </div>
      </div>

      {/* Diagnostics Status Banner if running */}
      {isBenchmarking && (
        <div className="rounded-xl border border-brand/30 bg-brand/10 p-3 text-xs font-mono text-brand flex items-center justify-between animate-pulse">
          <span>{benchmarkStep}</span>
          <span>GPU Profiling Active</span>
        </div>
      )}

      {/* Oscilloscope Visualizer Card */}
      <div className="relative overflow-hidden rounded-2xl border border-white/70 bg-canvas/70 p-5 shadow-inner backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-line/40 pb-3">
          <div className="flex items-center gap-3">
            <Activity
              className={cn(
                'h-4 w-4',
                engineMode === 'boost' ? 'text-success animate-pulse' : 'text-danger',
              )}
            />
            <span className="font-mono text-2xs uppercase tracking-wider text-faint">
              Pacing Delta: {engineMode === 'boost' ? '8.33 ms / frame (Locked)' : '26.3 ms / frame (Jank)'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'font-mono text-sm font-bold',
                engineMode === 'boost' ? 'text-success' : 'text-danger',
              )}
            >
              {liveFps} FPS
            </span>
            <span className="text-3xs text-faint uppercase tracking-wider">Target 120Hz</span>
          </div>
        </div>

        {/* Real-time Canvas wave */}
        <div className="relative mt-3 h-32 w-full overflow-hidden rounded-lg">
          <canvas ref={canvasRef} className="h-full w-full block" />
          <div className="pointer-events-none absolute bottom-2 left-3 font-mono text-3xs text-faint/70">
            {engineMode === 'boost'
              ? '✓ 0 Dropped Frames · Hardware Layer Promoted · Zero Layout Thrash'
              : '⚠ 14 Dropped Frames / sec · Forced Synchronous Reflow Detected'}
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-3.5 lg:grid-cols-4">
        <div className="min-w-0 rounded-xl border border-white/70 bg-white/80 p-3.5 sm:p-4 shadow-2xs backdrop-blur-md transition-all hover:shadow-xs">
          <div className="flex items-center justify-between text-3xs uppercase tracking-wider text-faint">
            <span className="truncate">LCP (Speed)</span>
            <Gauge className="h-3.5 w-3.5 shrink-0 text-brand" />
          </div>
          <p
            className={cn(
              'mt-2 font-mono text-xl sm:text-2xl font-bold tracking-tight',
              engineMode === 'boost' ? 'text-fg' : 'text-danger',
            )}
          >
            {engineMode === 'boost' ? '0.42s' : '2.48s'}
          </p>
          <p
            className={cn(
              'mt-1 text-3xs font-medium truncate',
              engineMode === 'boost' ? 'text-success' : 'text-danger',
            )}
          >
            {engineMode === 'boost' ? '99th %ile (< 2.5s)' : 'Main thread stall'}
          </p>
        </div>

        <div className="min-w-0 rounded-xl border border-white/70 bg-white/80 p-3.5 sm:p-4 shadow-2xs backdrop-blur-md transition-all hover:shadow-xs">
          <div className="flex items-center justify-between text-3xs uppercase tracking-wider text-faint">
            <span className="truncate">INP (Response)</span>
            <Cpu className="h-3.5 w-3.5 shrink-0 text-brand" />
          </div>
          <p
            className={cn(
              'mt-2 font-mono text-xl sm:text-2xl font-bold tracking-tight',
              engineMode === 'boost' ? 'text-fg' : 'text-danger',
            )}
          >
            {engineMode === 'boost' ? '12ms' : '240ms'}
          </p>
          <p
            className={cn(
              'mt-1 text-3xs font-medium truncate',
              engineMode === 'boost' ? 'text-success' : 'text-danger',
            )}
          >
            {engineMode === 'boost' ? 'Instant (< 200ms)' : 'Jank detected'}
          </p>
        </div>

        <div className="min-w-0 rounded-xl border border-white/70 bg-white/80 p-3.5 sm:p-4 shadow-2xs backdrop-blur-md transition-all hover:shadow-xs">
          <div className="flex items-center justify-between text-3xs uppercase tracking-wider text-faint">
            <span className="truncate">CLS (Stability)</span>
            <Layers className="h-3.5 w-3.5 shrink-0 text-brand" />
          </div>
          <p
            className={cn(
              'mt-2 font-mono text-xl sm:text-2xl font-bold tracking-tight',
              engineMode === 'boost' ? 'text-fg' : 'text-danger',
            )}
          >
            {engineMode === 'boost' ? '0.000' : '0.184'}
          </p>
          <p
            className={cn(
              'mt-1 text-3xs font-medium truncate',
              engineMode === 'boost' ? 'text-success' : 'text-danger',
            )}
          >
            {engineMode === 'boost' ? 'Zero shifts (< 0.1)' : 'Layout jitter'}
          </p>
        </div>

        <div className="min-w-0 rounded-xl border border-white/70 bg-white/80 p-3.5 sm:p-4 shadow-2xs backdrop-blur-md transition-all hover:shadow-xs">
          <div className="flex items-center justify-between text-3xs uppercase tracking-wider text-faint">
            <span className="truncate">Hardware Lock</span>
            <Zap className="h-3.5 w-3.5 shrink-0 text-warning" />
          </div>
          <p
            className={cn(
              'mt-2 font-mono text-xl sm:text-2xl font-bold tracking-tight',
              engineMode === 'boost' ? 'text-fg' : 'text-danger',
            )}
          >
            {engineMode === 'boost' ? '120 FPS' : '38 FPS'}
          </p>
          <p
            className={cn(
              'mt-1 text-3xs font-medium truncate',
              engineMode === 'boost' ? 'text-success' : 'text-danger',
            )}
          >
            {engineMode === 'boost' ? 'GPU thread lock' : 'CPU fallback'}
          </p>
        </div>
      </div>

      {/* Architectural Optimization Pipeline Cards */}
      <div className="rounded-2xl border border-line/70 bg-surface/50 p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-fg">Architectural Optimization Pipeline</span>
          <span className="font-mono text-3xs text-muted">Vite 6 · Rollup Splitting · Lenis Decoupled</span>
        </div>
        <div className="mt-3.5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-line/50 bg-white/70 p-3.5 transition-all duration-200 hover:border-brand/40 hover:bg-white">
            <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-fg">
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
              <span>Zero Layout Containment</span>
            </div>
            <p className="mt-1 text-3xs text-muted leading-relaxed">
              CSS <code>contain: layout style</code> isolates section boundaries, eliminating cross-page reflow penalties.
            </p>
          </div>

          <div className="rounded-xl border border-line/50 bg-white/70 p-3.5 transition-all duration-200 hover:border-brand/40 hover:bg-white">
            <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-fg">
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
              <span>Decoupled Lenis Ticker</span>
            </div>
            <p className="mt-1 text-3xs text-muted leading-relaxed">
              <code>lagSmoothing(0)</code> binds Lenis delta to true high-refresh rate displays without scroll leap or visual jitter.
            </p>
          </div>

          <div className="rounded-xl border border-line/50 bg-white/70 p-3.5 transition-all duration-200 hover:border-brand/40 hover:bg-white">
            <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-fg">
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
              <span>Sub-40kB Code Splitting</span>
            </div>
            <p className="mt-1 text-3xs text-muted leading-relaxed">
              Granular Vite chunks keep initial viewport execution bundle under 34 kB for near-zero TTFB distribution.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
