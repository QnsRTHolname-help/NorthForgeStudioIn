import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/* ── Card ──────────────────────────────────────────────────────── */

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Adds a hover elevation — for interactive cards only. */
  interactive?: boolean;
  padded?: boolean;
}

export function Card({ interactive, padded = true, className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'relative rounded-lg border border-line bg-surface transition-[border-color,box-shadow,transform] duration-300 ease-forge',
        padded && 'p-5',
        interactive && 'hover:-translate-y-0.5 hover:border-line-strong hover:shadow-lift',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold tracking-tight text-fg">{title}</h3>
        {description ? <p className="mt-1 text-[13px] leading-relaxed text-muted">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/* ── Section header used across all three experiences ──────────── */

export function SectionHeader({
  eyebrow,
  title,
  description,
  align = 'left',
  action,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: 'left' | 'center';
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4',
        align === 'center' ? 'items-center text-center' : 'items-start',
        action && align === 'left' && 'sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className={cn('flex flex-col gap-3', align === 'center' && 'items-center')}>
        {eyebrow ? <span className="nf-eyebrow">{eyebrow}</span> : null}
        <h2 className="max-w-3xl text-headline font-semibold text-fg">{title}</h2>
        {description ? (
          <p className={cn('max-w-2xl text-[15px] leading-relaxed text-muted', align === 'center' && 'mx-auto')}>
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/* ── KPI card ──────────────────────────────────────────────────── */

export function KpiCard({
  label,
  value,
  hint,
  delta,
  icon,
  loading,
  onClick,
  children,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  delta?: { value: number; suffix?: string } | null;
  icon?: ReactNode;
  loading?: boolean;
  onClick?: () => void;
  children?: ReactNode;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      {...(onClick ? { onClick, type: 'button' as const } : {})}
      className={cn(
        'group relative flex flex-col gap-3 rounded-lg border border-line bg-surface p-5 text-left transition-colors duration-300 ease-forge',
        onClick && 'hover:border-line-strong hover:bg-elevated',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-medium text-muted">{label}</span>
        {icon ? <span className="text-faint transition-colors group-hover:text-brand">{icon}</span> : null}
      </div>

      {loading ? (
        <div className="h-8 w-24 animate-pulse rounded bg-sunken" aria-hidden />
      ) : (
        <div className="flex items-baseline gap-2">
          <span className="nf-num text-[26px] font-semibold leading-none tracking-tight text-fg">{value}</span>
          {delta && delta.value !== 0 ? (
            <span
              className={cn(
                'nf-num text-xs font-medium',
                delta.value > 0 ? 'text-success' : 'text-danger',
              )}
            >
              {delta.value > 0 ? '+' : ''}
              {delta.value}
              {delta.suffix ?? '%'}
            </span>
          ) : null}
        </div>
      )}

      {children}
      {hint ? <p className="text-xs leading-relaxed text-faint">{hint}</p> : null}
    </Tag>
  );
}

/* ── Generic titled panel (used heavily in portal + admin) ─────── */

export function Panel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn('overflow-hidden rounded-lg border border-line bg-surface', className)}>
      {title ? (
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold tracking-tight text-fg">{title}</h2>
            {description ? <p className="mt-0.5 text-[13px] text-muted">{description}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </header>
      ) : null}
      <div className={cn('p-5', bodyClassName)}>{children}</div>
    </section>
  );
}
