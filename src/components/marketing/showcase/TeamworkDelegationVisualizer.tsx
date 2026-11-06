import { useState, useCallback } from 'react';
import {
  Users,
  CheckCircle2,
  Clock,
  RefreshCw,
  Check,
} from 'lucide-react';
import { useReducedMotion } from '@/hooks';
import { cn } from '@/lib/cn';

interface TeamTask {
  id: string;
  name: string;
  role: string;
  avatarText: string;
  project: string;
  deliverable: string;
  status: 'In Progress' | 'Review' | 'Live' | 'Synced';
  progress: number;
  timeRemaining: string;
}

interface TeamCategory {
  category: string;
  rolePill: string;
  tasks: TeamTask[];
}

const INITIAL_TEAM_COLUMNS: TeamCategory[] = [
  {
    category: 'Client Strategy & Growth',
    rolePill: 'Account Director',
    tasks: [
      {
        id: 'tm-1',
        name: 'Karthik Shenoy',
        role: 'Growth Strategist',
        avatarText: 'KS',
        project: 'Bright Smiles Dental Clinic',
        deliverable: 'WhatsApp automated re-engagement campaign sequence & ROI modeling',
        status: 'In Progress',
        progress: 88,
        timeRemaining: 'Est. 45 mins',
      },
      {
        id: 'tm-2',
        name: 'Pooja Hegde',
        role: 'Client Success Lead',
        avatarText: 'PH',
        project: 'Adiga Constructions',
        deliverable: 'B2B inquiry qualification criteria & custom proposal portal review',
        status: 'Review',
        progress: 94,
        timeRemaining: 'Under client review',
      },
    ],
  },
  {
    category: 'Creative & Design Engineering',
    rolePill: 'Lead Architect',
    tasks: [
      {
        id: 'tm-3',
        name: 'Farhan Akhtar',
        role: 'Design Technologist',
        avatarText: 'FA',
        project: 'Pai Orthodontics',
        deliverable: 'Generative UI booking widget prototype with Apple glass treatment',
        status: 'Synced',
        progress: 100,
        timeRemaining: 'Pushed to staging',
      },
      {
        id: 'tm-4',
        name: 'Ananya Prabhu',
        role: 'Motion & WebGL Engineer',
        avatarText: 'AP',
        project: 'NorthForge Core',
        deliverable: 'Interactive 120 FPS hardware composited 3D wireframe hero layer',
        status: 'In Progress',
        progress: 76,
        timeRemaining: 'Est. 2 hrs',
      },
    ],
  },
  {
    category: 'Systems & AI Automation',
    rolePill: 'Systems Lead',
    tasks: [
      {
        id: 'tm-5',
        name: 'Vikram Nayak',
        role: 'Autonomous AI Specialist',
        avatarText: 'VN',
        project: 'Mangaluru Spine & Rehab',
        deliverable: 'Dual-engine intent triage: Supabase Edge Function to Google Calendar',
        status: 'Live',
        progress: 100,
        timeRemaining: 'Active in production',
      },
      {
        id: 'tm-6',
        name: 'Strix Security Bot',
        role: 'AppSec Autonomous Agent',
        avatarText: 'SX',
        project: 'Ecosystem Security Gate',
        deliverable: 'Automated OWASP Top 10 pentest run across all authenticated routes',
        status: 'Live',
        progress: 100,
        timeRemaining: 'Zero vulnerabilities',
      },
    ],
  },
];

const ORCHESTRATION_STAGES = [
  { label: 'Client Requirement', sub: 'Brief scoped' },
  { label: 'AI Decomposition', sub: 'Autonomous sub-tasks' },
  { label: 'Specialist Execution', sub: 'Engineers & Agents' },
  { label: 'Live Client Portal Sync', sub: 'Verified & Shipped' },
];

export function TeamworkDelegationVisualizer({ className }: { className?: string }) {
  const reduced = useReducedMotion();
  const [columns, setColumns] = useState<TeamCategory[]>(INITIAL_TEAM_COLUMNS);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Simulated Instant Delegation Sync Wave
  const handleSync = useCallback(() => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncMessage('Delegation pulse dispatched across 6 specialist streams...');

    setTimeout(() => {
      setColumns((prev) =>
        prev.map((col) => ({
          ...col,
          tasks: col.tasks.map((task) => ({
            ...task,
            progress: Math.min(100, task.progress + (task.progress < 100 ? 6 : 0)),
            status: task.progress >= 94 ? 'Synced' : task.status,
          })),
        })),
      );
      setSyncMessage('✓ Sync Complete: Owner dashboard and client portal verified in lockstep.');
      setIsSyncing(false);
      setTimeout(() => setSyncMessage(null), 3000);
    }, 900);
  }, [isSyncing]);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Top Delegation Pipeline & Telemetry Header */}
      <div className="flex flex-col gap-4 border-b border-line/60 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-brand" />
            <span className="font-mono text-2xs uppercase tracking-wider text-brand font-semibold">
              Agency OS · Delegation & Teamwork Orchestration
            </span>
            <span className="nf-glass-pill rounded-full px-2 py-0.5 font-mono text-3xs font-semibold text-success">
              6 Active Specialists
            </span>
          </div>
          <p className="mt-1 text-xs text-muted">
            Assigned projects, deliverables, autonomous AI agents, and employee contributions sync live into the owner dashboard.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleSync}
            disabled={isSyncing}
            className={cn(
              'nf-glass-interactive inline-flex items-center gap-2 rounded-xl border border-brand/40 bg-brand/10 px-3.5 py-2 text-xs font-semibold text-brand transition-all hover:bg-brand hover:text-white shadow-2xs',
              isSyncing && 'opacity-70 cursor-not-allowed',
            )}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isSyncing && 'animate-spin')} />
            <span>{isSyncing ? 'Synchronizing...' : 'Simulate Team Sync'}</span>
          </button>
        </div>
      </div>

      {/* Sync Status Banner */}
      {syncMessage && (
        <div className="rounded-xl border border-brand/30 bg-brand/10 p-3 text-xs font-mono text-brand flex items-center justify-between animate-fade-in">
          <span>{syncMessage}</span>
          <span className="text-3xs uppercase tracking-wider text-success font-bold">Latency 14ms</span>
        </div>
      )}

      {/* Orchestration Stage Flow Bar */}
      <div className="rounded-2xl border border-white/70 bg-white/60 p-4 shadow-2xs backdrop-blur-md">
        <div className="flex items-center justify-between text-3xs font-mono uppercase tracking-wider text-faint mb-3">
          <span>Autonomous Delegation Pipeline</span>
          <span className="text-success font-semibold flex items-center gap-1">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            Continuous 60Hz Dispatch
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ORCHESTRATION_STAGES.map((stage, idx) => (
            <div
              key={stage.label}
              className="relative rounded-xl border border-line/60 bg-white/70 p-3 transition-all hover:border-brand/40"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-3xs font-bold text-brand">0{idx + 1}</span>
                <Check className="h-3 w-3 text-success" />
              </div>
              <p className="mt-1.5 text-xs font-semibold text-fg leading-tight">{stage.label}</p>
              <p className="mt-0.5 text-3xs text-muted">{stage.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 3-Column Task Delegation Matrix */}
      <div className="nf-scroll-x pb-2">
        <div className="flex min-w-[960px] gap-3.5">
          {columns.map((col) => (
            <div key={col.category} className="flex-1">
              <div
                className="flex h-full flex-col rounded-2xl border border-white/60 bg-white/75 shadow-2xs backdrop-blur-md transition-all duration-300"
                style={{
                  boxShadow:
                    '0 12px 32px -8px rgb(60 48 32 / 0.08), inset 0 1px 0 rgb(255 255 255 / 0.95)',
                }}
              >
                <header className="flex items-center justify-between gap-2 border-b border-line/50 px-4 py-3 bg-white/40 rounded-t-2xl">
                  <span className="text-2xs font-semibold uppercase tracking-wider text-muted">
                    {col.category}
                  </span>
                  <span className="nf-glass-pill rounded-full px-2.5 py-0.5 text-3xs font-semibold text-brand shadow-2xs">
                    {col.rolePill}
                  </span>
                </header>

                <ul className="flex-1 space-y-3 p-3">
                  {col.tasks.map((task) => (
                    <li
                      key={task.id}
                      className="nf-glass-interactive group rounded-xl border border-white/70 bg-white/85 p-4 shadow-2xs transition-all duration-200 hover:border-brand/40 hover:bg-white hover:shadow-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="relative">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand/15 text-2xs font-bold text-brand">
                              {task.avatarText}
                            </span>
                            <span
                              className={cn(
                                'absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-white',
                                task.status === 'Synced' || task.status === 'Live'
                                  ? 'bg-success'
                                  : 'bg-warning',
                              )}
                            />
                          </div>
                          <div>
                            <p className="text-[13px] font-semibold leading-none text-fg">{task.name}</p>
                            <p className="mt-1 text-3xs text-faint">{task.role}</p>
                          </div>
                        </div>

                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-3xs font-semibold',
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

                      <div className="mt-3.5 border-t border-line/50 pt-2.5">
                        <p className="text-3xs uppercase tracking-wider text-brand font-semibold">
                          {task.project}
                        </p>
                        <p className="mt-1 text-xs text-muted leading-snug">{task.deliverable}</p>
                      </div>

                      <div className="mt-3.5">
                        <div className="flex justify-between text-3xs text-faint mb-1.5 font-mono">
                          <span>Completion Pace</span>
                          <span className="font-bold text-fg">{task.progress}%</span>
                        </div>
                        <div className="relative h-2 w-full overflow-hidden rounded-full bg-line/60">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-brand to-brand-violet transition-all duration-700 relative overflow-hidden"
                            style={{ width: `${task.progress}%` }}
                          >
                            {!reduced && (
                              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer-fast" />
                            )}
                          </div>
                        </div>
                        <p className="mt-1.5 text-right font-mono text-3xs text-faint">{task.timeRemaining}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
