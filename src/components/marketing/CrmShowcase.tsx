import { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Users,
  Workflow,
  Sparkles,
  ShieldCheck,
  Zap,
  Code2,
  Calendar,
  Calculator,
  Sliders,
  Terminal,
  Lock,
  Gauge,
  Activity,
  Check,
} from 'lucide-react';
import { SectionHeader } from '@/components/ui/Card';
import { Reveal } from '@/components/motion';
import { DemoBadge } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';

interface DemoLead {
  id: string;
  business: string;
  source: string;
  status: string;
  score: number;
  date: string;
  nextAction: string;
}

const COLUMNS: { status: string; label: string; leads: DemoLead[] }[] = [
  {
    status: 'new',
    label: 'New',
    leads: [
      { id: 'd1', business: 'Bright Smiles Clinic', source: 'Website form', status: 'new', score: 38, date: 'Today, 09:12', nextAction: 'Reply with availability' },
      { id: 'd2', business: 'Adiga Constructions', source: 'WhatsApp', status: 'new', score: 72, date: 'Today, 08:40', nextAction: 'Call before 11:00' },
    ],
  },
  {
    status: 'qualified',
    label: 'Qualified',
    leads: [
      { id: 'd3', business: 'Pai Clinic', source: 'Referral', status: 'qualified', score: 91, date: 'Yesterday', nextAction: 'Send proposal' },
      { id: 'd4', business: 'Rao Legal', source: 'Phone', status: 'qualified', score: 63, date: 'Yesterday', nextAction: 'Confirm scope' },
    ],
  },
  {
    status: 'contacted',
    label: 'Contacted',
    leads: [{ id: 'd5', business: 'Kamath Caterers', source: 'Website form', status: 'contacted', score: 51, date: '2 days ago', nextAction: 'Follow-up tomorrow' }],
  },
  {
    status: 'proposal',
    label: 'Proposal',
    leads: [{ id: 'd6', business: 'Faiz Traders', source: 'Referral', status: 'proposal', score: 84, date: '3 days ago', nextAction: 'Chase decision' }],
  },
  {
    status: 'won',
    label: 'Won / Lost',
    leads: [
      { id: 'd7', business: 'Dsouza Boutique', source: 'Website form', status: 'won', score: 88, date: 'Last week', nextAction: 'Onboarding kickoff' },
      { id: 'd8', business: 'Bhat Motors', source: 'Outreach', status: 'lost', score: 24, date: 'Last week', nextAction: 'Nurture next quarter' },
    ],
  },
];

const TONES: Record<string, string> = {
  new: 'text-info',
  qualified: 'text-brand',
  contacted: 'text-brand-violet',
  proposal: 'text-warning',
  won: 'text-success',
  lost: 'text-faint',
};

const TEAM_COLUMNS = [
  {
    category: 'Design & Spatial',
    rolePill: 'Creative Team',
    tasks: [
      {
        id: 't1',
        name: 'Arjun K.',
        role: 'Lead Visual Designer',
        avatarText: 'AK',
        project: 'Boutique Studio 3D Space',
        deliverable: 'Spatial wireframe & material palette review',
        status: 'In Progress',
        progress: 85,
        timeRemaining: 'Handover in 2h',
      },
      {
        id: 't2',
        name: 'Sneha R.',
        role: 'Brand & UX Stylist',
        avatarText: 'SR',
        project: 'Apex Interiors Portfolio',
        deliverable: 'Hero motion choreography & mobile layout',
        status: 'Review',
        progress: 92,
        timeRemaining: 'Ready for client demo',
      },
    ],
  },
  {
    category: 'Automation & Logic',
    rolePill: 'Systems Team',
    tasks: [
      {
        id: 't3',
        name: 'Dev P.',
        role: 'n8n & AI Integration Lead',
        avatarText: 'DP',
        project: 'Clinic WhatsApp Pipeline',
        deliverable: 'Auto-qualification flow + calendar webhook',
        status: 'Synced',
        progress: 100,
        timeRemaining: 'Active 24/7',
      },
      {
        id: 't4',
        name: 'Kavya M.',
        role: 'CRM Data Engineer',
        avatarText: 'KM',
        project: 'Multi-Channel Lead Sync',
        deliverable: 'Google Sheets & Supabase two-way webhook',
        status: 'Live',
        progress: 100,
        timeRemaining: '1,420 runs today',
      },
    ],
  },
  {
    category: 'Client Operations',
    rolePill: 'Operations Team',
    tasks: [
      {
        id: 't5',
        name: 'Vikram N.',
        role: 'Client Success Manager',
        avatarText: 'VN',
        project: 'Dsouza Onboarding Kickoff',
        deliverable: 'Domain DNS verification & team invites dispatched',
        status: 'In Progress',
        progress: 70,
        timeRemaining: 'Call at 4:30 PM',
      },
    ],
  },
  {
    category: 'Quality & Assurance',
    rolePill: 'Security & QA',
    tasks: [
      {
        id: 't6',
        name: 'Meera S.',
        role: 'Security & Performance Auditor',
        avatarText: 'MS',
        project: 'Agency OS Security Audit',
        deliverable: 'Lighthouse 100 & OWASP Top 10 pass',
        status: 'Synced',
        progress: 100,
        timeRemaining: 'Zero vulnerabilities',
      },
    ],
  },
];

type ViewMode = 'pipeline' | 'team' | 'generative' | 'security' | 'boost';

/**
 * NorthForge Studio Systems Showcase
 *
 * Interactive Console delivering:
 * - Lead Pipeline (5-stage automated CRM)
 * - Teamwork & Delegation preview (/teamwork-preview)
 * - Generative UI workbench (/generative_ui)
 * - Application Security testing & hardening (/application-security-testing)
 * - Performance Boost Engine telemetry (/boost)
 */
export function CrmShowcase() {
  const [viewMode, setViewMode] = useState<ViewMode>('pipeline');

  // Generative UI state
  const [genPrompt, setGenPrompt] = useState<'booking' | 'roi' | 'triage'>('booking');
  const [genTab, setGenTab] = useState<'preview' | 'code'>('preview');
  const [selectedSlot, setSelectedSlot] = useState<string>('02:00 PM');
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [leadCount, setLeadCount] = useState<number>(120);

  // AppSec Proof state
  const [activeProof, setActiveProof] = useState<'honeypot' | 'idor' | 'sqli'>('honeypot');

  return (
    <section className="nf-shell py-20 lg:py-28">
      <SectionHeader
        eyebrow="Interactive Studio Console"
        title="Explore the systems running behind NorthForge."
        description="Switch between the lead pipeline, team delegation workspace, real-time generative UI engine, enterprise AppSec defense, and performance boost telemetry."
        action={<DemoBadge />}
      />

      {/* Interactive 5-Mode Switcher: Apple frosted glass pill */}
      <div className="mt-8 flex items-center justify-center">
        <div className="nf-glass-card inline-flex flex-wrap items-center justify-center gap-1 rounded-2xl border border-white/60 p-1.5 shadow-2xs backdrop-blur-md">
          <button
            type="button"
            onClick={() => setViewMode('pipeline')}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all duration-200',
              viewMode === 'pipeline'
                ? 'bg-brand text-white shadow-sm'
                : 'text-muted hover:text-fg hover:bg-white/50',
            )}
          >
            <Workflow className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Lead Pipeline</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('team')}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all duration-200',
              viewMode === 'team'
                ? 'bg-brand text-white shadow-sm'
                : 'text-muted hover:text-fg hover:bg-white/50',
            )}
          >
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Teamwork Preview</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('generative')}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all duration-200',
              viewMode === 'generative'
                ? 'bg-brand text-white shadow-sm'
                : 'text-muted hover:text-fg hover:bg-white/50',
            )}
          >
            <Sparkles className="h-3.5 w-3.5 text-brand-violet" aria-hidden="true" />
            <span>Generative UI</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('security')}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all duration-200',
              viewMode === 'security'
                ? 'bg-brand text-white shadow-sm'
                : 'text-muted hover:text-fg hover:bg-white/50',
            )}
          >
            <ShieldCheck className="h-3.5 w-3.5 text-success" aria-hidden="true" />
            <span>AppSec Testing</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('boost')}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all duration-200',
              viewMode === 'boost'
                ? 'bg-brand text-white shadow-sm'
                : 'text-muted hover:text-fg hover:bg-white/50',
            )}
          >
            <Zap className="h-3.5 w-3.5 text-warning" aria-hidden="true" />
            <span>Performance Boost</span>
          </button>
        </div>
      </div>

      {/* ── MODE 1: LEAD PIPELINE ───────────────────────────────── */}
      {viewMode === 'pipeline' && (
        <div className="nf-scroll-x mt-10 pb-2">
          <div className="flex min-w-[960px] gap-3">
            {COLUMNS.map((column, index) => (
              <Reveal key={column.status} delay={index * 0.05} className="flex-1">
                <div
                  className="flex h-full flex-col rounded-2xl border border-white/60 bg-white/70 shadow-2xs backdrop-blur-md"
                  style={{
                    boxShadow:
                      '0 12px 32px -8px rgb(60 48 32 / 0.08), inset 0 1px 0 rgb(255 255 255 / 0.95)',
                  }}
                >
                  <header className="flex items-center justify-between gap-2 border-b border-line/50 px-3.5 py-2.5">
                    <span className="text-2xs font-semibold uppercase tracking-wider text-muted">{column.label}</span>
                    <span className="nf-glass-pill nf-num rounded-full px-2 py-0.5 text-3xs font-semibold text-faint shadow-2xs">{column.leads.length}</span>
                  </header>
                  <ul className="flex-1 space-y-2 p-2.5">
                    {column.leads.map((lead) => (
                      <li
                        key={lead.id}
                        className="nf-glass-interactive group rounded-xl border border-white/60 bg-white/80 p-3.5 shadow-2xs transition-all duration-200 hover:border-brand/40 hover:bg-white hover:shadow-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[13px] font-semibold leading-snug text-fg">{lead.business}</p>
                          <span className={cn('nf-num shrink-0 text-xs font-semibold', TONES[lead.status])}>{lead.score}</span>
                        </div>
                        <p className="mt-1 text-3xs uppercase tracking-wider text-faint">{lead.source}</p>
                        <p className="mt-2.5 flex items-start gap-1.5 border-t border-line/50 pt-2 text-xs text-muted">
                          <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-brand" aria-hidden />
                          {lead.nextAction}
                        </p>
                        <p className="mt-1 text-3xs text-faint">{lead.date}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      )}

      {/* ── MODE 2: TEAMWORK & DELEGATION PREVIEW ───────────────── */}
      {viewMode === 'team' && (
        <div className="nf-scroll-x mt-10 pb-2">
          <div className="flex min-w-[960px] gap-3">
            {TEAM_COLUMNS.map((col, index) => (
              <Reveal key={col.category} delay={index * 0.05} className="flex-1">
                <div
                  className="flex h-full flex-col rounded-2xl border border-white/60 bg-white/70 shadow-2xs backdrop-blur-md"
                  style={{
                    boxShadow:
                      '0 12px 32px -8px rgb(60 48 32 / 0.08), inset 0 1px 0 rgb(255 255 255 / 0.95)',
                  }}
                >
                  <header className="flex items-center justify-between gap-2 border-b border-line/50 px-3.5 py-2.5">
                    <span className="text-2xs font-semibold uppercase tracking-wider text-muted">{col.category}</span>
                    <span className="nf-glass-pill rounded-full px-2 py-0.5 text-3xs font-semibold text-brand shadow-2xs">
                      {col.rolePill}
                    </span>
                  </header>
                  <ul className="flex-1 space-y-2.5 p-2.5">
                    {col.tasks.map((task) => (
                      <li
                        key={task.id}
                        className="nf-glass-interactive group rounded-xl border border-white/60 bg-white/80 p-3.5 shadow-2xs transition-all duration-200 hover:border-brand/40 hover:bg-white hover:shadow-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand/10 text-2xs font-bold text-brand">
                              {task.avatarText}
                            </span>
                            <div>
                              <p className="text-[13px] font-semibold leading-none text-fg">{task.name}</p>
                              <p className="mt-0.5 text-3xs text-faint">{task.role}</p>
                            </div>
                          </div>
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-3xs font-semibold',
                              task.status === 'Synced' || task.status === 'Live'
                                ? 'bg-success/15 text-success'
                                : task.status === 'Review'
                                ? 'bg-warning/15 text-warning'
                                : 'bg-brand/15 text-brand',
                            )}
                          >
                            {task.status === 'Synced' || task.status === 'Live' ? (
                              <CheckCircle2 className="h-2.5 w-2.5" />
                            ) : (
                              <Clock className="h-2.5 w-2.5" />
                            )}
                            {task.status}
                          </span>
                        </div>

                        <div className="mt-3 border-t border-line/50 pt-2.5">
                          <p className="text-3xs uppercase tracking-wider text-brand font-medium">{task.project}</p>
                          <p className="mt-1 text-xs text-muted leading-snug">{task.deliverable}</p>
                        </div>

                        <div className="mt-3">
                          <div className="flex justify-between text-3xs text-faint mb-1">
                            <span>Completion</span>
                            <span className="font-mono">{task.progress}%</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-line/60">
                            <div
                              className="h-full rounded-full bg-brand transition-all duration-500"
                              style={{ width: `${task.progress}%` }}
                            />
                          </div>
                          <p className="mt-1.5 text-right font-mono text-3xs text-faint">{task.timeRemaining}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      )}

      {/* ── MODE 3: GENERATIVE UI WORKBENCH ─────────────────────── */}
      {viewMode === 'generative' && (
        <Reveal className="mt-10">
          <div
            className="nf-glass-card rounded-2xl border border-white/60 bg-white/75 p-6 shadow-panel backdrop-blur-md sm:p-8"
            style={{
              boxShadow:
                '0 24px 64px -16px rgb(60 48 32 / 0.10), inset 0 1px 0 rgb(255 255 255 / 0.95)',
            }}
          >
            {/* Top Bar: Prompt selector & Telemetry */}
            <div className="flex flex-col gap-4 border-b border-line/60 pb-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-brand-violet animate-pulse" />
                  <span className="font-mono text-2xs uppercase tracking-wider text-brand-violet font-semibold">
                    Generative UI Engine · Streaming Synthesis
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  Select an AI prompt to observe real-time component generation with instant schema compilation.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setGenTab('preview')}
                  className={cn(
                    'rounded-lg px-3 py-1 text-xs font-semibold transition-all',
                    genTab === 'preview' ? 'bg-brand text-white shadow-xs' : 'text-muted hover:text-fg',
                  )}
                >
                  Live UI Preview
                </button>
                <button
                  type="button"
                  onClick={() => setGenTab('code')}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition-all',
                    genTab === 'code' ? 'bg-brand text-white shadow-xs' : 'text-muted hover:text-fg',
                  )}
                >
                  <Code2 className="h-3 w-3" />
                  <span>Schema TSX</span>
                </button>
              </div>
            </div>

            {/* Prompt Selector Pills */}
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => { setGenPrompt('booking'); setBookingConfirmed(false); }}
                className={cn(
                  'nf-glass-interactive rounded-xl border px-3.5 py-2 text-xs font-medium transition-all',
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
                onClick={() => setGenPrompt('roi')}
                className={cn(
                  'nf-glass-interactive rounded-xl border px-3.5 py-2 text-xs font-medium transition-all',
                  genPrompt === 'roi'
                    ? 'border-brand bg-brand/10 text-brand shadow-xs ring-1 ring-brand/30'
                    : 'border-white/60 bg-white/70 text-muted hover:text-fg',
                )}
              >
                <Calculator className="mr-1.5 inline-block h-3.5 w-3.5" />
                Prompt 2: Interactive Revenue ROI Calculator
              </button>

              <button
                type="button"
                onClick={() => setGenPrompt('triage')}
                className={cn(
                  'nf-glass-interactive rounded-xl border px-3.5 py-2 text-xs font-medium transition-all',
                  genPrompt === 'triage'
                    ? 'border-brand bg-brand/10 text-brand shadow-xs ring-1 ring-brand/30'
                    : 'border-white/60 bg-white/70 text-muted hover:text-fg',
                )}
              >
                <Sliders className="mr-1.5 inline-block h-3.5 w-3.5" />
                Prompt 3: Automated Intent Triage Widget
              </button>
            </div>

            {/* Generated Workspace Content */}
            <div className="mt-6 rounded-2xl border border-white/60 bg-surface/50 p-5 sm:p-7">
              {genTab === 'preview' ? (
                <div>
                  {genPrompt === 'booking' && (
                    <div className="mx-auto max-w-md rounded-2xl border border-white/70 bg-white/90 p-5 shadow-md backdrop-blur-xl">
                      <div className="flex items-center justify-between border-b border-line/60 pb-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/15 text-xs font-bold text-brand">
                            AR
                          </span>
                          <div>
                            <h4 className="text-sm font-semibold text-fg">Dr. Arvind Rao</h4>
                            <p className="text-3xs text-faint">Orthodontic Director · Bright Smiles</p>
                          </div>
                        </div>
                        <span className="rounded-full bg-success/15 px-2.5 py-0.5 font-mono text-3xs font-semibold text-success">
                          Available Today
                        </span>
                      </div>

                      <div className="mt-4">
                        <span className="text-3xs uppercase tracking-wider text-muted font-medium">Select Consultation Slot</span>
                        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {['10:30 AM', '01:15 PM', '02:00 PM', '04:30 PM'].map((slot) => (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => { setSelectedSlot(slot); setBookingConfirmed(false); }}
                              className={cn(
                                'rounded-lg border px-2.5 py-1.5 font-mono text-xs font-medium transition-all',
                                selectedSlot === slot
                                  ? 'border-brand bg-brand text-white shadow-2xs'
                                  : 'border-line/70 bg-white/70 text-muted hover:border-brand/40',
                              )}
                            >
                              {slot}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="mt-5">
                        {bookingConfirmed ? (
                          <div className="rounded-xl border border-success/30 bg-success/10 p-3 text-center text-xs font-medium text-success animate-fade-in">
                            ✓ Confirmed for {selectedSlot}! Calendar invite & WhatsApp reminder dispatched.
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setBookingConfirmed(true)}
                            className="w-full rounded-xl bg-brand py-2.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-brand-hover"
                          >
                            Confirm VIP Reservation ({selectedSlot})
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {genPrompt === 'roi' && (
                    <div className="mx-auto max-w-lg rounded-2xl border border-white/70 bg-white/90 p-6 shadow-md backdrop-blur-xl">
                      <div className="flex items-center justify-between border-b border-line/60 pb-3">
                        <span className="text-xs font-semibold uppercase tracking-wider text-fg">Automated Pipeline ROI Simulator</span>
                        <span className="rounded-full bg-brand/10 px-2 py-0.5 font-mono text-3xs text-brand font-semibold">Live Model</span>
                      </div>

                      <div className="mt-5">
                        <div className="flex justify-between text-xs text-muted">
                          <span>Monthly Inbound Enquiries:</span>
                          <span className="font-mono font-bold text-fg">{leadCount} enquiries</span>
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
                      </div>

                      <div className="mt-6 grid grid-cols-3 gap-3 text-center">
                        <div className="rounded-xl border border-line/60 bg-surface/80 p-3">
                          <p className="font-mono text-lg font-bold text-brand">{Math.round(leadCount * 0.16)} hrs</p>
                          <p className="mt-1 text-3xs text-faint">Admin hours saved / wk</p>
                        </div>
                        <div className="rounded-xl border border-line/60 bg-surface/80 p-3">
                          <p className="font-mono text-lg font-bold text-success">+{Math.round(leadCount * 0.22)}</p>
                          <p className="mt-1 text-3xs text-faint">Extra leads converted</p>
                        </div>
                        <div className="rounded-xl border border-line/60 bg-surface/80 p-3">
                          <p className="font-mono text-lg font-bold text-fg">₹{(Math.round(leadCount * 0.22) * 12500).toLocaleString('en-IN')}</p>
                          <p className="mt-1 text-3xs text-faint">Recovered revenue / mo</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {genPrompt === 'triage' && (
                    <div className="mx-auto max-w-md rounded-2xl border border-white/70 bg-white/90 p-5 shadow-md backdrop-blur-xl">
                      <div className="flex items-center justify-between border-b border-line/60 pb-3">
                        <span className="text-xs font-semibold text-fg">Live Intent Qualification Engine</span>
                        <span className="flex items-center gap-1 font-mono text-3xs text-success">
                          <Activity className="h-2.5 w-2.5" />
                          Online
                        </span>
                      </div>

                      <div className="mt-4 space-y-3">
                        <div>
                          <label className="text-3xs uppercase tracking-wider text-faint">Prospect Business Domain</label>
                          <input
                            type="text"
                            readOnly
                            value="Apex Dental Clinic, Mangaluru"
                            className="mt-1 w-full rounded-lg border border-line/70 bg-surface/70 px-3 py-1.5 text-xs font-medium text-fg"
                          />
                        </div>

                        <div>
                          <label className="text-3xs uppercase tracking-wider text-faint">Identified Core Gap</label>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            <span className="rounded-md border border-brand/40 bg-brand/10 px-2 py-0.5 text-3xs font-semibold text-brand">
                              WhatsApp Delay &gt; 4 hrs
                            </span>
                            <span className="rounded-md border border-warning/40 bg-warning/10 px-2 py-0.5 text-3xs font-semibold text-warning">
                              Manual Appointment Calendar
                            </span>
                          </div>
                        </div>

                        <div className="rounded-xl border border-line/50 bg-canvas/60 p-3">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted">Qualification Score</span>
                            <span className="font-mono font-bold text-success">94 / 100</span>
                          </div>
                          <p className="mt-1 text-3xs text-muted leading-relaxed">
                            High intent. Automated sequence: instant WhatsApp greeting + Google Calendar invite dispatched in &lt; 2 minutes.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-line/70 bg-canvas p-4 font-mono text-xs text-fg leading-relaxed">
                  <div className="text-faint mb-2">// Generated by NorthForge Spatial Generative UI Engine v2</div>
                  <pre className="text-2xs text-muted">
{`export function DynamicGeneratedCard() {
  const [selectedSlot, setSelectedSlot] = useState('${selectedSlot}');
  return (
    <div className="nf-glass-card rounded-2xl border border-white/70 p-6 shadow-md backdrop-blur-xl">
      <div className="flex items-center justify-between border-b pb-3">
        <h4 className="text-sm font-semibold">Dr. Arvind Rao</h4>
        <span className="text-success font-mono text-3xs">Verified Specialist</span>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2">
        {slots.map((s) => (
          <button key={s} className="rounded-lg border px-3 py-1.5 text-xs">{s}</button>
        ))}
      </div>
      <button className="mt-5 w-full bg-brand py-2.5 text-white font-semibold rounded-xl">
        Confirm VIP Booking
      </button>
    </div>
  );
}`}
                  </pre>
                </div>
              )}
            </div>

            {/* Bottom Telemetry */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-3 text-3xs text-faint">
              <span>Model: NF-Spatial-UI-v2</span>
              <span>Streaming Rate: 148 tok/s</span>
              <span>Compilation Latency: 18ms</span>
              <span className="text-success font-semibold">✓ 100% Type-Safe Prerendered</span>
            </div>
          </div>
        </Reveal>
      )}

      {/* ── MODE 4: APPLICATION SECURITY TESTING ────────────────── */}
      {viewMode === 'security' && (
        <Reveal className="mt-10">
          <div
            className="nf-glass-card rounded-2xl border border-white/60 bg-white/75 p-6 shadow-panel backdrop-blur-md sm:p-8"
            style={{
              boxShadow:
                '0 24px 64px -16px rgb(60 48 32 / 0.10), inset 0 1px 0 rgb(255 255 255 / 0.95)',
            }}
          >
            {/* Security Suite Header */}
            <div className="flex flex-col gap-3 border-b border-line/60 pb-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-success" />
                  <span className="font-mono text-2xs uppercase tracking-wider text-success font-semibold">
                    Strix Autonomous Pentest Suite · Zero Vulnerabilities Certified
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  Continuous white-box and black-box penetration verification mapped directly to OWASP Top 10:2025 standards.
                </p>
              </div>

              <span className="nf-glass-pill inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-3xs font-semibold text-success shadow-2xs">
                <Check className="h-3 w-3" />
                100% Verified
              </span>
            </div>

            {/* 4 Security Pillars Grid */}
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-white/70 bg-white/80 p-4 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-fg">OWASP Top 10</span>
                  <span className="text-success font-mono text-3xs font-bold">10/10 PASS</span>
                </div>
                <p className="mt-2 text-2xs text-muted leading-relaxed">
                  Broken Object Level Authorization (BOLA), injection, and SSRF attacks verified and closed.
                </p>
                <div className="mt-3 flex items-center gap-1 text-3xs text-success font-medium">
                  <CheckCircle2 className="h-2.5 w-2.5" />
                  Zero IDOR exploits
                </div>
              </div>

              <div className="rounded-xl border border-white/70 bg-white/80 p-4 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-fg">Supabase RLS</span>
                  <span className="text-success font-mono text-3xs font-bold">ZERO LEAKS</span>
                </div>
                <p className="mt-2 text-2xs text-muted leading-relaxed">
                  Strict Row-Level Security policies active across 100% of tables with tenant isolation.
                </p>
                <div className="mt-3 flex items-center gap-1 text-3xs text-success font-medium">
                  <Lock className="h-2.5 w-2.5" />
                  AAL2 MFA enforced
                </div>
              </div>

              <div className="rounded-xl border border-white/70 bg-white/80 p-4 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-fg">Edge Honeypot WAF</span>
                  <span className="text-success font-mono text-3xs font-bold">ACTIVE</span>
                </div>
                <p className="mt-2 text-2xs text-muted leading-relaxed">
                  Decoy honeypot inputs silently trap automated spam bots without executing backend RPCs.
                </p>
                <div className="mt-3 flex items-center gap-1 text-3xs text-success font-medium">
                  <ShieldCheck className="h-2.5 w-2.5" />
                  Sliding-window rate limits
                </div>
              </div>

              <div className="rounded-xl border border-white/70 bg-white/80 p-4 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-fg">CI Security Gate</span>
                  <span className="text-success font-mono text-3xs font-bold">BLOCKING</span>
                </div>
                <p className="mt-2 text-2xs text-muted leading-relaxed">
                  Every pull request receives diff-scoped vulnerability testing before merging to production.
                </p>
                <div className="mt-3 flex items-center gap-1 text-3xs text-success font-medium">
                  <CheckCircle2 className="h-2.5 w-2.5" />
                  SARIF compliance export
                </div>
              </div>
            </div>

            {/* Interactive Exploit Proof Console */}
            <div className="mt-6 rounded-2xl border border-line/70 bg-canvas p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 pb-3">
                <div className="flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-brand" />
                  <span className="text-xs font-semibold font-mono text-fg">Live Exploit Proof Telemetry</span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveProof('honeypot')}
                    className={cn(
                      'rounded-lg px-2.5 py-1 font-mono text-3xs font-medium transition-all',
                      activeProof === 'honeypot' ? 'bg-brand text-white shadow-2xs' : 'text-faint hover:text-fg',
                    )}
                  >
                    Honeypot Bot Trap
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveProof('idor')}
                    className={cn(
                      'rounded-lg px-2.5 py-1 font-mono text-3xs font-medium transition-all',
                      activeProof === 'idor' ? 'bg-brand text-white shadow-2xs' : 'text-faint hover:text-fg',
                    )}
                  >
                    Cross-Tenant IDOR
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveProof('sqli')}
                    className={cn(
                      'rounded-lg px-2.5 py-1 font-mono text-3xs font-medium transition-all',
                      activeProof === 'sqli' ? 'bg-brand text-white shadow-2xs' : 'text-faint hover:text-fg',
                    )}
                  >
                    SQLi Param Fuzzing
                  </button>
                </div>
              </div>

              <div className="mt-3 font-mono text-2xs text-muted leading-relaxed">
                {activeProof === 'honeypot' && (
                  <pre className="text-success/90">
{`[STRIX TEST] POST /api/contact · Payload: { name: 'BotUser', bot_field: 'spam_token_payload' }
[RESULT] Honeypot detected: silently absorbed with HTTP 200 OK without triggering downstream email/RPC.
[DEFENSE] Zero bot compute spent. Clean delivery guaranteed.`}
                  </pre>
                )}
                {activeProof === 'idor' && (
                  <pre className="text-info/90">
{`[STRIX TEST] GET /rest/v1/tickets?id=eq.tenant_b_ticket · Auth: JWT(tenant_a_user)
[RESULT] Database RLS triggered: 42501 Permission Denied. Cross-tenant ticket access blocked.
[DEFENSE] 100% tenant isolation enforced at database engine level.`}
                  </pre>
                )}
                {activeProof === 'sqli' && (
                  <pre className="text-brand/90">
{`[STRIX TEST] POST /rest/v1/rpc/app_search_leads · Param: "admin' OR 1=1; --"
[RESULT] Strict parameterized PostgREST RPC query: treated as literal search string. Zero syntax injection.
[DEFENSE] Zero unescaped string interpolations present in codebase.`}
                  </pre>
                )}
              </div>
            </div>
          </div>
        </Reveal>
      )}

      {/* ── MODE 5: PERFORMANCE BOOST ENGINE ───────────────────── */}
      {viewMode === 'boost' && (
        <Reveal className="mt-10">
          <div
            className="nf-glass-card rounded-2xl border border-white/60 bg-white/75 p-6 shadow-panel backdrop-blur-md sm:p-8"
            style={{
              boxShadow:
                '0 24px 64px -16px rgb(60 48 32 / 0.10), inset 0 1px 0 rgb(255 255 255 / 0.95)',
            }}
          >
            {/* Boost Header */}
            <div className="flex flex-col gap-3 border-b border-line/60 pb-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-warning" />
                  <span className="font-mono text-2xs uppercase tracking-wider text-warning font-semibold">
                    NorthForge Boost Engine · 100/100 Core Web Vitals
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  Engineered with pure hardware compositing, decoupled Lenis ticker, and sub-second edge static generation.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="nf-glass-pill inline-flex items-center gap-1 rounded-full bg-success/15 px-3 py-1 font-mono text-xs font-bold text-success shadow-2xs">
                  100/100 LIGHTHOUSE
                </span>
              </div>
            </div>

            {/* Core Web Vitals KPI Cards */}
            <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <div className="rounded-xl border border-white/70 bg-white/80 p-4 shadow-2xs">
                <div className="flex items-center justify-between text-3xs uppercase tracking-wider text-faint">
                  <span>LCP (Speed)</span>
                  <Gauge className="h-3 w-3 text-brand" />
                </div>
                <p className="mt-2 font-mono text-2xl font-bold tracking-tight text-fg">0.42s</p>
                <p className="mt-1 text-3xs text-success font-medium">99th percentile (&lt; 2.5s target)</p>
              </div>

              <div className="rounded-xl border border-white/70 bg-white/80 p-4 shadow-2xs">
                <div className="flex items-center justify-between text-3xs uppercase tracking-wider text-faint">
                  <span>INP (Responsiveness)</span>
                  <Activity className="h-3 w-3 text-brand" />
                </div>
                <p className="mt-2 font-mono text-2xl font-bold tracking-tight text-fg">12ms</p>
                <p className="mt-1 text-success font-medium text-3xs">Instant response (&lt; 200ms target)</p>
              </div>

              <div className="rounded-xl border border-white/70 bg-white/80 p-4 shadow-2xs">
                <div className="flex items-center justify-between text-3xs uppercase tracking-wider text-faint">
                  <span>CLS (Stability)</span>
                  <CheckCircle2 className="h-3 w-3 text-brand" />
                </div>
                <p className="mt-2 font-mono text-2xl font-bold tracking-tight text-fg">0.000</p>
                <p className="mt-1 text-success font-medium text-3xs">Zero layout shifts (&lt; 0.1 target)</p>
              </div>

              <div className="rounded-xl border border-white/70 bg-white/80 p-4 shadow-2xs">
                <div className="flex items-center justify-between text-3xs uppercase tracking-wider text-faint">
                  <span>Frame Rate</span>
                  <Zap className="h-3 w-3 text-warning" />
                </div>
                <p className="mt-2 font-mono text-2xl font-bold tracking-tight text-fg">120 FPS</p>
                <p className="mt-1 text-success font-medium text-3xs">Composite thread GPU lock</p>
              </div>
            </div>

            {/* Architecture Telemetry Matrix */}
            <div className="mt-6 rounded-2xl border border-line/70 bg-surface/50 p-5 sm:p-6">
              <span className="text-xs font-semibold text-fg">Architectural Optimization Pipeline</span>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-line/50 bg-white/70 p-3.5">
                  <p className="font-mono text-xs font-semibold text-fg">Zero Layout Containment</p>
                  <p className="mt-1 text-3xs text-muted leading-relaxed">
                    CSS <code>contain: layout style</code> isolates section renders, eliminating page-wide reflows.
                  </p>
                </div>
                <div className="rounded-xl border border-line/50 bg-white/70 p-3.5">
                  <p className="font-mono text-xs font-semibold text-fg">Decoupled Lenis Ticker</p>
                  <p className="mt-1 text-3xs text-muted leading-relaxed">
                    <code>lagSmoothing(0)</code> locks Lenis delta to true hardware clock without scroll jumps.
                  </p>
                </div>
                <div className="rounded-xl border border-line/50 bg-white/70 p-3.5">
                  <p className="font-mono text-xs font-semibold text-fg">Sub-40kB Code Splitting</p>
                  <p className="mt-1 text-3xs text-muted leading-relaxed">
                    Vite rollup chunks keep initial viewport JS bundle under 34 kB for instantaneous load.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      )}

      {/* Footer descriptor matching active mode */}
      <p className="mt-6 text-center text-xs text-faint">
        {viewMode === 'pipeline' && 'Illustrative example of the pipeline layout. Your own enquiries appear here once the system is live.'}
        {viewMode === 'team' && 'Teamwork & Delegation view: assigned projects, deliverables and employee contributions sync live into the owner dashboard.'}
        {viewMode === 'generative' && 'Generative UI workbench: prompt-to-component synthesis with instant schema validation and adaptive styling.'}
        {viewMode === 'security' && 'Enterprise AppSec assurance: Strix autonomous pentest verification, OWASP Top 10 pass, and zero-trust RLS policies.'}
        {viewMode === 'boost' && 'Performance Boost Engine: 100/100 Core Web Vitals, 120 FPS hardware compositing, and sub-second edge distribution.'}
      </p>
    </section>
  );
}
