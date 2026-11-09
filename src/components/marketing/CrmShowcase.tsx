import { useEffect, useState, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Users,
  Workflow,
  Sparkles,
  ShieldCheck,
  Zap,
  Terminal,
  Lock,
  Check,
} from 'lucide-react';
import { SectionHeader } from '@/components/ui/Card';
import { Reveal, AtmosphericGlow } from '@/components/motion';
import { DemoBadge } from '@/components/ui/Badge';
import { useSmoothScroll } from '@/components/motion/SmoothScroll';
import { cn } from '@/lib/cn';
import { BoostEngineVisualizer } from './showcase/BoostEngineVisualizer';
import { TeamworkDelegationVisualizer } from './showcase/TeamworkDelegationVisualizer';
import { GenerativeUiVisualizer } from './showcase/GenerativeUiVisualizer';

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
  const location = useLocation();
  const { scrollTo } = useSmoothScroll();
  const isFirstMountRef = useRef(true);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const viewParam = params.get('view');
    const path = location.pathname.toLowerCase().replace(/^\//, '');
    const hash = location.hash.toLowerCase().replace(/^#/, '');

    let targetMode: ViewMode | null = null;
    if (viewParam === 'generative' || path === 'generative_ui' || path === 'generative-ui' || hash === 'generative_ui' || hash === 'generative-ui') {
      targetMode = 'generative';
    } else if (viewParam === 'boost' || path === 'boost' || hash === 'boost') {
      targetMode = 'boost';
    } else if (viewParam === 'team' || path === 'teamwork-preview' || path === 'teamwork' || hash === 'teamwork-preview' || hash === 'teamwork') {
      targetMode = 'team';
    } else if (viewParam === 'security' || path === 'application-security-testing' || hash === 'application-security-testing' || hash === 'appsec') {
      targetMode = 'security';
    } else if (viewParam === 'pipeline' || hash === 'pipeline') {
      targetMode = 'pipeline';
    }

    if (targetMode) {
      setViewMode(targetMode);
      if (
        path === 'generative_ui' ||
        path === 'generative-ui' ||
        path === 'boost' ||
        path === 'teamwork' ||
        path === 'teamwork-preview' ||
        path === 'application-security-testing' ||
        hash === 'systems' ||
        hash === 'showcase' ||
        hash === targetMode
      ) {
        const isFreshLanding = isFirstMountRef.current && (typeof window !== 'undefined' ? window.scrollY < 300 : false);
        isFirstMountRef.current = false;
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const section = document.getElementById('systems');
            if (section) {
              scrollTo(section, { offset: 0, immediate: isFreshLanding });
            }
          });
        });
      }
    }
  }, [location.pathname, location.search, location.hash, scrollTo]);

  const selectMode = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    const modePathMap: Record<ViewMode, string> = {
      pipeline: '/',
      team: '/teamwork',
      generative: '/generative-ui',
      security: '/application-security-testing',
      boost: '/boost',
    };
    if (typeof window !== 'undefined' && window.history?.replaceState) {
      const targetUrl = modePathMap[mode] || '/';
      window.history.replaceState(null, '', targetUrl);
    }
  }, []);

  // AppSec Proof state
  const [activeProof, setActiveProof] = useState<'honeypot' | 'idor' | 'sqli'>('honeypot');

  return (
    <section id="systems" data-showcase className="nf-shell relative scroll-mt-28 py-20 lg:py-28 overflow-hidden">
      <AtmosphericGlow color="blue" position="top-center" />
      <Reveal>
        <SectionHeader
          eyebrow="Interactive Studio Console"
          title="Explore the systems running behind NorthForge."
          description="Switch between the lead pipeline, team delegation workspace, real-time generative UI engine, enterprise AppSec defense, and performance boost telemetry."
          action={<DemoBadge />}
        />
      </Reveal>

      {/* Interactive 5-Mode Switcher: Apple frosted glass pill */}
      <div className="mt-8 flex items-center justify-center">
        <div className="nf-glass-card inline-flex flex-wrap items-center justify-center gap-1 rounded-2xl border border-white/60 p-1.5 shadow-2xs backdrop-blur-md">
          <button
            type="button"
            onClick={() => selectMode('pipeline')}
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
            onClick={() => selectMode('team')}
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
            onClick={() => selectMode('generative')}
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
            onClick={() => selectMode('security')}
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
            onClick={() => selectMode('boost')}
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

      {/* ── Active Console View with fluid tab transition ─────── */}
      <div key={viewMode} className="animate-fade-in">
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
        <Reveal className="mt-10">
          <TeamworkDelegationVisualizer />
        </Reveal>
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
            <GenerativeUiVisualizer />
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
            <BoostEngineVisualizer />
          </div>
        </Reveal>
      )}
      </div>

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
