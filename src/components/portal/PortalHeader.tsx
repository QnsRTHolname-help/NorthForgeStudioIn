import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { DemoBadge } from '@/components/ui/Badge';

/**
 * Portal page header (spec §114).
 * Plain business language: "Your website is live", never "Deployment: production".
 */
export function PortalHeader({
  title,
  description,
  action,
  demo,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  demo?: boolean;
  className?: string;
}) {
  return (
    <header className={cn('mb-6 flex flex-col gap-4', className)}>
      {/* Same rhythm as AdminHeader: actions get their own row on narrow
          screens so Add-style buttons stay full-size and never wrap mid-label. */}
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-fg">{title}</h1>
          {demo ? <DemoBadge /> : null}
        </div>
        {description ? <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-muted">{description}</p> : null}
      </div>
      {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
    </header>
  );
}

/** "What this means" callout used to explain metrics in plain language. */
export function Explain({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-sunken/40 p-4">
      <p className="text-2xs font-medium uppercase tracking-wider text-faint">{title}</p>
      <div className="mt-1.5 text-[13px] leading-relaxed text-muted">{children}</div>
    </div>
  );
}

/** Metric row used inside panels: label on the left, value on the right. */
export function MetricRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: ReactNode;
  tone?: 'default' | 'success' | 'warning' | 'danger';
}) {
  const tones = {
    default: 'text-fg',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
  };
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 last:border-0">
      <span className="text-[13px] text-muted">{label}</span>
      <span className={cn('nf-num text-[13px] font-medium', tones[tone ?? 'default'])}>{value}</span>
    </div>
  );
}
