import { useState, useCallback } from 'react';
import {
  Code2,
  Calendar,
  Calculator,
  Sliders,
  Activity,
  Check,
  Copy,
  CheckCheck,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { useReducedMotion } from '@/hooks';
import { cn } from '@/lib/cn';

interface GenerativeUiVisualizerProps {
  className?: string;
}

export function GenerativeUiVisualizer({ className }: GenerativeUiVisualizerProps) {
  const reduced = useReducedMotion();
  const [genPrompt, setGenPrompt] = useState<'booking' | 'roi' | 'triage'>('booking');
  const [genTab, setGenTab] = useState<'preview' | 'code'>('preview');
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthesisState, setSynthesisState] = useState('Synthesis Ready');

  // Booking Card State
  const [selectedSlot, setSelectedSlot] = useState<string>('02:00 PM');
  const [bookingConfirmed, setBookingConfirmed] = useState(false);

  // ROI Simulator State
  const [leadCount, setLeadCount] = useState<number>(140);

  // Copy code state
  const [copied, setCopied] = useState(false);

  // Prompt switcher with simulated streaming AST compilation
  const handlePromptSelect = useCallback((prompt: 'booking' | 'roi' | 'triage') => {
    if (prompt === genPrompt) return;
    setGenPrompt(prompt);
    setBookingConfirmed(false);
    setIsSynthesizing(true);
    setSynthesisState('Compiling TSX AST & Schema...');

    setTimeout(() => {
      setSynthesisState('Hydrated in 11ms · 120 FPS GPU lock');
      setIsSynthesizing(false);
    }, 450);
  }, [genPrompt]);

  const copyCodeToClipboard = () => {
    const code = getCodeSnippet(genPrompt, selectedSlot, leadCount);
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ROI Calculations
  const hoursSaved = Math.round(leadCount * 0.16);
  const extraLeads = Math.round(leadCount * 0.22);
  const recoveredRevenue = extraLeads * 12500;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Top Bar: Prompt selector & Telemetry */}
      <div className="flex flex-col gap-4 border-b border-line/60 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-brand-violet opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-violet" />
            </span>
            <span className="font-mono text-2xs uppercase tracking-wider text-brand-violet font-semibold">
              Generative UI Engine · Streaming Synthesis
            </span>
            <span className="nf-glass-pill rounded-full px-2 py-0.5 font-mono text-3xs font-semibold text-brand">
              {synthesisState}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted">
            Select an AI prompt to observe real-time component generation with instant schema compilation and responsive motion.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setGenTab('preview')}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200',
              genTab === 'preview'
                ? 'bg-brand text-white shadow-xs'
                : 'text-muted hover:text-fg hover:bg-white/50',
            )}
          >
            Live UI Preview
          </button>
          <button
            type="button"
            onClick={() => setGenTab('code')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200',
              genTab === 'code'
                ? 'bg-brand text-white shadow-xs'
                : 'text-muted hover:text-fg hover:bg-white/50',
            )}
          >
            <Code2 className="h-3 w-3" />
            <span>Schema TSX</span>
          </button>
        </div>
      </div>

      {/* Prompt Selector Pills */}
      <div className="flex flex-wrap gap-2.5">
        <button
          type="button"
          onClick={() => handlePromptSelect('booking')}
          className={cn(
            'nf-glass-interactive rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all duration-200',
            genPrompt === 'booking'
              ? 'border-brand bg-brand/10 text-brand shadow-xs ring-1 ring-brand/30'
              : 'border-white/60 bg-white/70 text-muted hover:text-fg',
          )}
        >
          <Calendar className="mr-1.5 inline-block h-3.5 w-3.5" />
          Prompt 1: 1-Click VIP Booking Card
        </button>

        <button
          type="button"
          onClick={() => handlePromptSelect('roi')}
          className={cn(
            'nf-glass-interactive rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all duration-200',
            genPrompt === 'roi'
              ? 'border-brand bg-brand/10 text-brand shadow-xs ring-1 ring-brand/30'
              : 'border-white/60 bg-white/70 text-muted hover:text-fg',
          )}
        >
          <Calculator className="mr-1.5 inline-block h-3.5 w-3.5" />
          Prompt 2: Interactive Revenue ROI Simulator
        </button>

        <button
          type="button"
          onClick={() => handlePromptSelect('triage')}
          className={cn(
            'nf-glass-interactive rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all duration-200',
            genPrompt === 'triage'
              ? 'border-brand bg-brand/10 text-brand shadow-xs ring-1 ring-brand/30'
              : 'border-white/60 bg-white/70 text-muted hover:text-fg',
          )}
        >
          <Sliders className="mr-1.5 inline-block h-3.5 w-3.5" />
          Prompt 3: Automated Intent Triage Widget
        </button>
      </div>

      {/* Synthesis Active Shimmer Effect */}
      {!reduced && isSynthesizing && (
        <div className="relative h-1 w-full overflow-hidden rounded-full bg-brand-violet/20">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-brand-violet to-transparent animate-shimmer-fast" />
        </div>
      )}

      {/* Generated Workspace Content */}
      <div className="rounded-2xl border border-white/60 bg-surface/50 p-5 sm:p-7 backdrop-blur-md">
        {genTab === 'preview' ? (
          <div>
            {/* ── PROMPT 1: VIP BOOKING CARD ──────────────────────────── */}
            {genPrompt === 'booking' && (
              <div className="mx-auto max-w-md rounded-2xl border border-white/70 bg-white/90 p-5 sm:p-6 shadow-md backdrop-blur-xl transition-all duration-300">
                <div className="flex items-center justify-between border-b border-line/60 pb-3.5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/15 text-xs font-bold text-brand">
                      AR
                    </span>
                    <div>
                      <h4 className="text-sm font-semibold text-fg">Dr. Arvind Rao</h4>
                      <p className="text-3xs text-faint">Orthodontic Director · Bright Smiles</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-0.5 font-mono text-3xs font-semibold text-success">
                    <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                    Available Today
                  </span>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-3xs uppercase tracking-wider text-muted font-semibold">
                      Select Consultation Slot
                    </span>
                    <span className="font-mono text-3xs text-brand">Instant Sync</span>
                  </div>
                  <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {['10:30 AM', '01:15 PM', '02:00 PM', '04:30 PM'].map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => {
                          setSelectedSlot(slot);
                          setBookingConfirmed(false);
                        }}
                        className={cn(
                          'rounded-xl border px-2.5 py-2 font-mono text-xs font-semibold transition-all duration-200',
                          selectedSlot === slot
                            ? 'border-brand bg-brand text-white shadow-xs'
                            : 'border-line/70 bg-white/70 text-muted hover:border-brand/40 hover:bg-white',
                        )}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-5">
                  {bookingConfirmed ? (
                    <div className="rounded-xl border border-success/40 bg-success/10 p-4 text-center animate-fade-in space-y-2">
                      <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-success/20 text-success">
                        <Check className="h-5 w-5" />
                      </div>
                      <p className="text-xs font-bold text-success">
                        VIP Reservation Confirmed for {selectedSlot}!
                      </p>
                      <p className="text-3xs text-muted">
                        Google Calendar invite dispatched & WhatsApp reminder scheduled in &lt; 2 minutes.
                      </p>
                      <button
                        type="button"
                        onClick={() => setBookingConfirmed(false)}
                        className="mt-2 text-3xs font-semibold text-brand underline underline-offset-2"
                      >
                        Reset demo
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setBookingConfirmed(true)}
                      className="group w-full rounded-xl bg-brand py-3 text-xs font-semibold text-white shadow-sm transition-all hover:bg-brand-hover hover:shadow-md flex items-center justify-center gap-2"
                    >
                      <span>Confirm VIP Reservation ({selectedSlot})</span>
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ── PROMPT 2: ROI SIMULATOR WITH DYNAMIC AREA SPLINE ─────── */}
            {genPrompt === 'roi' && (
              <div className="mx-auto max-w-lg rounded-2xl border border-white/70 bg-white/90 p-5 sm:p-7 shadow-md backdrop-blur-xl">
                <div className="flex items-center justify-between border-b border-line/60 pb-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-brand" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-fg">
                      Automated Pipeline ROI Simulator
                    </span>
                  </div>
                  <span className="rounded-full bg-brand/10 px-2.5 py-0.5 font-mono text-3xs text-brand font-semibold">
                    Dynamic Spline
                  </span>
                </div>

                <div className="mt-4">
                  <div className="flex justify-between text-xs text-muted">
                    <span>Monthly Inbound Enquiries:</span>
                    <span className="font-mono font-bold text-fg text-sm">{leadCount} enquiries</span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="600"
                    step="10"
                    value={leadCount}
                    onChange={(e) => setLeadCount(Number(e.target.value))}
                    className="mt-2.5 w-full accent-brand cursor-pointer"
                  />
                  <div className="flex justify-between text-3xs text-faint font-mono mt-1">
                    <span>20 min</span>
                    <span>300</span>
                    <span>600 max</span>
                  </div>
                </div>

                {/* Dynamic SVG Area Spline Visualizer */}
                <div className="mt-4 rounded-xl border border-line/60 bg-surface/80 p-3">
                  <div className="flex items-center justify-between text-3xs font-mono text-faint mb-1.5">
                    <span>Revenue Trajectory: Without vs With NorthForge</span>
                    <span className="text-success font-semibold">+{extraLeads} Extra Converted</span>
                  </div>
                  <svg viewBox="0 0 320 80" className="h-20 w-full overflow-visible">
                    <defs>
                      <linearGradient id="roi-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgb(36, 88, 197)" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="rgb(36, 88, 197)" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    {/* Baseline curve (Without automation) */}
                    <path
                      d="M 10 70 Q 160 62 310 50"
                      fill="none"
                      stroke="rgba(110, 108, 102, 0.4)"
                      strokeWidth="1.5"
                      strokeDasharray="4 3"
                    />
                    {/* Accelerated curve (With NorthForge OS) */}
                    {(() => {
                      const lift = Math.min(55, (leadCount / 600) * 55);
                      const targetY = 60 - lift;
                      const controlY = 65 - lift * 0.7;
                      return (
                        <>
                          <path
                            d={`M 10 70 Q 140 ${controlY} 310 ${targetY} L 310 75 L 10 75 Z`}
                            fill="url(#roi-grad)"
                          />
                          <path
                            d={`M 10 70 Q 140 ${controlY} 310 ${targetY}`}
                            fill="none"
                            stroke="rgb(36, 88, 197)"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                          />
                          <circle cx="310" cy={targetY} r="4" fill="rgb(36, 88, 197)" />
                        </>
                      );
                    })()}
                  </svg>
                </div>

                {/* 3 Metric Readout Cards */}
                <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-xl border border-line/60 bg-surface/80 p-3">
                    <p className="font-mono text-lg font-bold text-brand">{hoursSaved} hrs</p>
                    <p className="mt-1 text-3xs text-faint">Admin hours saved / wk</p>
                  </div>
                  <div className="rounded-xl border border-line/60 bg-surface/80 p-3">
                    <p className="font-mono text-lg font-bold text-success">+{extraLeads}</p>
                    <p className="mt-1 text-3xs text-faint">Extra leads converted</p>
                  </div>
                  <div className="rounded-xl border border-line/60 bg-surface/80 p-3">
                    <p className="font-mono text-lg font-bold text-fg">
                      ₹{recoveredRevenue.toLocaleString('en-IN')}
                    </p>
                    <p className="mt-1 text-3xs text-faint">Recovered revenue / mo</p>
                  </div>
                </div>
              </div>
            )}

            {/* ── PROMPT 3: AUTOMATED INTENT TRIAGE WIDGET ─────────────── */}
            {genPrompt === 'triage' && (
              <div className="mx-auto max-w-md rounded-2xl border border-white/70 bg-white/90 p-5 sm:p-6 shadow-md backdrop-blur-xl">
                <div className="flex items-center justify-between border-b border-line/60 pb-3">
                  <span className="text-xs font-semibold text-fg">Live Intent Qualification Engine</span>
                  <span className="flex items-center gap-1 font-mono text-3xs text-success font-semibold">
                    <Activity className="h-3 w-3 animate-pulse" />
                    Radar Online
                  </span>
                </div>

                <div className="mt-4 space-y-3.5">
                  <div>
                    <label className="text-3xs uppercase tracking-wider text-faint font-semibold">
                      Prospect Business Profile
                    </label>
                    <input
                      type="text"
                      readOnly
                      value="Apex Dental Clinic, Mangaluru"
                      className="mt-1 w-full rounded-xl border border-line/70 bg-surface/70 px-3.5 py-2 text-xs font-medium text-fg"
                    />
                  </div>

                  <div>
                    <label className="text-3xs uppercase tracking-wider text-faint font-semibold">
                      Identified Pipeline Gaps
                    </label>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <span className="rounded-lg border border-brand/40 bg-brand/10 px-2.5 py-1 text-3xs font-semibold text-brand">
                        WhatsApp Response Delay &gt; 4 hrs
                      </span>
                      <span className="rounded-lg border border-warning/40 bg-warning/10 px-2.5 py-1 text-3xs font-semibold text-warning">
                        Manual Calendar Entry
                      </span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-line/50 bg-canvas/60 p-3.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted font-medium">Automated Score</span>
                      <span className="font-mono font-bold text-success text-sm">94 / 100 (VIP High Intent)</span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line/60">
                      <div className="h-full w-[94%] rounded-full bg-success" />
                    </div>
                    <p className="mt-2 text-3xs text-muted leading-relaxed">
                      Instant autonomous sequence: WhatsApp greeting + automated Google Calendar invite dispatched in &lt; 2 minutes.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Schema TSX Code Tab */
          <div className="relative overflow-hidden rounded-xl border border-line/70 bg-canvas p-5 font-mono text-xs text-fg">
            <div className="flex items-center justify-between border-b border-line/50 pb-3 mb-3">
              <span className="text-3xs text-faint">
                // Generated TSX Schema · NorthForge Spatial Generative UI Engine v2
              </span>
              <button
                type="button"
                onClick={copyCodeToClipboard}
                className="nf-glass-interactive inline-flex items-center gap-1.5 rounded-lg border border-line/60 bg-white/70 px-2.5 py-1 text-3xs font-semibold text-fg hover:border-brand"
              >
                {copied ? <CheckCheck className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                <span>{copied ? 'Copied!' : 'Copy TSX'}</span>
              </button>
            </div>
            <pre className="overflow-x-auto text-2xs text-muted leading-relaxed font-mono">
              {getCodeSnippet(genPrompt, selectedSlot, leadCount)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

function getCodeSnippet(prompt: 'booking' | 'roi' | 'triage', slot: string, leadCount: number): string {
  if (prompt === 'booking') {
    return `import { useState } from 'react';
import { Check, Calendar } from 'lucide-react';

export function GeneratedVipBookingCard() {
  const [selectedSlot, setSelectedSlot] = useState('${slot}');
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div className="nf-glass-card rounded-2xl p-6 border border-white/60 bg-white/90">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-fg">Dr. Arvind Rao</h4>
        <span className="text-success text-2xs font-mono">Available Today</span>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2">
        {['10:30 AM', '01:15 PM', '02:00 PM', '04:30 PM'].map((s) => (
          <button
            key={s}
            onClick={() => setSelectedSlot(s)}
            className={selectedSlot === s ? 'bg-brand text-white' : 'bg-surface text-muted'}
          >
            {s}
          </button>
        ))}
      </div>
      <button
        onClick={() => setConfirmed(true)}
        className="mt-5 w-full bg-brand text-white rounded-xl py-2.5 font-semibold"
      >
        {confirmed ? '✓ Confirmed' : \`Confirm Reservation (\${selectedSlot})\`}
      </button>
    </div>
  );
}`;
  }

  if (prompt === 'roi') {
    return `import { useState } from 'react';

export function GeneratedRoiSimulator() {
  const [leads, setLeads] = useState(${leadCount});
  const savedHours = Math.round(leads * 0.16);
  const extraRevenue = Math.round(leads * 0.22) * 12500;

  return (
    <div className="nf-glass-card rounded-2xl p-6">
      <input
        type="range"
        min="20"
        max="600"
        value={leads}
        onChange={(e) => setLeads(Number(e.target.value))}
      />
      <div className="grid grid-cols-2 gap-4 mt-4">
        <div>Hours Saved / Wk: {savedHours} hrs</div>
        <div>Recovered / Mo: ₹{extraRevenue.toLocaleString('en-IN')}</div>
      </div>
    </div>
  );
}`;
  }

  return `export function GeneratedIntentTriage() {
  return (
    <div className="nf-glass-card rounded-2xl p-6">
      <div className="text-xs uppercase font-mono">Qualification Score: 94 / 100</div>
      <p className="mt-2 text-muted">Sequence: Instant WhatsApp Greeting + Calendar Link</p>
    </div>
  );
}`;
}
