import { cn } from '@/lib/cn';

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn('inline-block h-4 w-4 animate-spin rounded-full border-2 border-line-strong border-t-brand', className)}
    />
  );
}

/** Full-area loading used by route-level suspense fallbacks. */
export function Loader({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <Spinner className="h-5 w-5" />
      <p className="text-[13px] text-faint">{label}…</p>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('relative overflow-hidden rounded bg-sunken', className)} aria-hidden>
    <span className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-fg/[0.06] to-transparent" />
  </div>;
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)} aria-hidden>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton key={index} className={cn('h-3', index === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}

/** Card-shaped placeholder that mirrors real layout to avoid layout shift. */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-lg border border-line bg-surface p-5', className)} aria-hidden>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-4 h-7 w-32" />
      <Skeleton className="mt-4 h-3 w-full" />
      <Skeleton className="mt-2 h-3 w-2/3" />
    </div>
  );
}

export function Progress({
  value,
  max = 100,
  tone = 'brand',
  size = 'md',
  label,
}: {
  value: number;
  max?: number;
  tone?: 'brand' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md';
  label?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const tones = {
    brand: 'bg-brand',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
  };

  return (
    <div className="w-full">
      {label ? (
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="text-muted">{label}</span>
          <span className="nf-num text-fg">{Math.round(pct)}%</span>
        </div>
      ) : null}
      <div
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Progress'}
        className={cn('w-full overflow-hidden rounded-full bg-sunken', size === 'sm' ? 'h-1' : 'h-1.5')}
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-700 ease-forge', tones[tone])}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/** Inline "saving / saved" indicator used by every form in the product. */
export function SaveState({ state }: { state: 'idle' | 'saving' | 'saved' }) {
  if (state === 'idle') return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-faint" aria-live="polite">
      {state === 'saving' ? (
        <>
          <Spinner className="h-3 w-3 border" /> Saving…
        </>
      ) : (
        <>Saved</>
      )}
    </span>
  );
}
