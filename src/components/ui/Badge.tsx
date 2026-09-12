import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'neutral' | 'brand' | 'violet' | 'success' | 'warning' | 'danger' | 'info';

const TONES: Record<Tone, string> = {
  neutral: 'border-line-strong bg-sunken text-muted',
  brand: 'border-brand/30 bg-brand/10 text-brand',
  violet: 'border-brand-violet/30 bg-brand-violet/10 text-brand-violet',
  success: 'border-success/30 bg-success/10 text-success',
  warning: 'border-warning/30 bg-warning/10 text-warning',
  danger: 'border-danger/30 bg-danger/10 text-danger',
  info: 'border-info/30 bg-info/10 text-info',
};

const DOTS: Record<Tone, string> = {
  neutral: 'bg-faint',
  brand: 'bg-brand',
  violet: 'bg-brand-violet',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
};

export function Badge({
  children,
  tone = 'neutral',
  dot,
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-2xs font-medium uppercase tracking-wide',
        TONES[tone],
        className,
      )}
    >
      {dot ? <span className={cn('h-1.5 w-1.5 rounded-full', DOTS[tone])} aria-hidden /> : null}
      {children}
    </span>
  );
}

/** Smaller, sentence-case variant for dense tables. */
export function Chip({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium capitalize',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Status indicator with a live pulse for in-flight states.
 * Status text is always rendered — colour is never the only signal (spec §89).
 */
export function StatusIndicator({
  status,
  tone = 'neutral',
  pulse,
  className,
}: {
  status: string;
  tone?: Tone;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-[13px] capitalize', className)}>
      <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
        {pulse ? (
          <span className={cn('absolute inline-flex h-full w-full animate-pulse-ring rounded-full', DOTS[tone])} />
        ) : null}
        <span className={cn('relative inline-flex h-2 w-2 rounded-full', DOTS[tone])} />
      </span>
      <span className="text-fg">{status.replace(/_/g, ' ')}</span>
    </span>
  );
}

/**
 * Demo-data marker (spec §86). Any record flagged is_demo in the database
 * is labelled here so it can never be mistaken for real performance.
 */
export function DemoBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded border border-dashed border-warning/50 bg-warning/[0.07] px-1.5 py-0.5 text-2xs font-medium uppercase tracking-wider text-warning',
        className,
      )}
      title="Sample data for demonstration — not real business records."
    >
      Demo data
    </span>
  );
}

/* ── Status → tone mapping, shared by every list in the product ── */

const STATUS_TONES: Record<string, Tone> = {
  // Leads / pipeline
  new: 'info',
  qualified: 'brand',
  contacted: 'violet',
  proposal: 'warning',
  won: 'success',
  lost: 'neutral',
  // Projects
  discovery: 'info',
  design: 'violet',
  development: 'brand',
  review: 'warning',
  launch: 'success',
  optimization: 'success',
  planning: 'info',
  active: 'success',
  on_hold: 'warning',
  completed: 'neutral',
  cancelled: 'neutral',
  // Tasks
  todo: 'neutral',
  in_progress: 'brand',
  done: 'success',
  // Websites
  live: 'success',
  building: 'brand',
  draft: 'neutral',
  paused: 'warning',
  offline: 'danger',
  pending: 'warning',
  failed: 'danger',
  // Billing
  paid: 'success',
  open: 'warning',
  void: 'neutral',
  uncollectible: 'danger',
  trialing: 'info',
  past_due: 'danger',
  succeeded: 'success',
  refunded: 'neutral',
  // Requests / tickets
  resolved: 'success',
  closed: 'neutral',
  blocked: 'danger',
  // Bookings
  confirmed: 'success',
  no_show: 'warning',
  // Priority
  low: 'neutral',
  medium: 'info',
  high: 'warning',
  urgent: 'danger',
  // Health
  operational: 'success',
  degraded: 'warning',
  unknown: 'neutral',
  checking: 'info',
};

export const statusTone = (status: string | null | undefined): Tone =>
  (status ? STATUS_TONES[status.toLowerCase()] : undefined) ?? 'neutral';
