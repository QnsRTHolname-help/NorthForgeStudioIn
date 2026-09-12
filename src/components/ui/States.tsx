import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, RefreshCw, SearchX, ShieldAlert, WifiOff } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from './Button';

/**
 * Production-empty and error states (spec §85, §96, §126).
 * Every list, chart and detail view uses these — no screen is ever blank.
 */

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed border-line text-center',
        compact ? 'px-5 py-8' : 'px-6 py-14',
        className,
      )}
    >
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full border border-line bg-sunken text-faint">
        {icon ?? <Inbox className="h-4.5 w-4.5" />}
      </div>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-fg">{title}</h3>
      {description ? <p className="mt-2 max-w-md text-[13px] leading-relaxed text-muted">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'We could not load this. The rest of NorthForge is still working.',
  onRetry,
  className,
  compact,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-danger/25 bg-danger/[0.04] text-center',
        compact ? 'px-5 py-8' : 'px-6 py-14',
        className,
      )}
      role="alert"
    >
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full border border-danger/25 bg-danger/10 text-danger">
        <AlertTriangle className="h-4.5 w-4.5" />
      </div>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-fg">{title}</h3>
      <p className="mt-2 max-w-md text-[13px] leading-relaxed text-muted">{description}</p>
      {onRetry ? (
        <Button variant="secondary" size="sm" className="mt-5" onClick={onRetry} iconLeft={<RefreshCw className="h-3.5 w-3.5" />}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function NetworkState({ onRetry }: { onRetry?: () => void }) {
  return (
    <ErrorState
      title="No connection"
      description="We could not reach NorthForge. Check your connection and try again — your data is safe."
      onRetry={onRetry}
    />
  );
}

export function NotFoundState({
  title = 'Not found',
  description = "This record does not exist, or it may have been removed.",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <EmptyState
      icon={<SearchX className="h-4.5 w-4.5" />}
      title={title}
      description={description}
      action={action}
    />
  );
}

export function ForbiddenState() {
  return (
    <EmptyState
      icon={<ShieldAlert className="h-4.5 w-4.5" />}
      title="No access"
      description="You don't have permission to view this. If you think this is a mistake, contact NorthForge support."
    />
  );
}

export function OfflineBanner({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded border border-warning/30 bg-warning/[0.07] px-3 py-2 text-[13px] text-warning">
      <span className="flex items-center gap-2">
        <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
        You appear to be offline. Changes will not save until the connection returns.
      </span>
      <button type="button" onClick={onRetry} className="shrink-0 font-medium underline underline-offset-2">
        Retry
      </button>
    </div>
  );
}

/** Wraps async content: handles loading, error, empty and success in one place. */
export function AsyncBoundary<T>({
  loading,
  error,
  errorCode,
  data,
  isEmpty,
  onRetry,
  skeleton,
  empty,
  children,
}: {
  loading: boolean;
  error: string | null;
  errorCode?: string | null;
  data: T | null;
  isEmpty?: (data: T) => boolean;
  onRetry?: () => void;
  skeleton?: ReactNode;
  empty?: ReactNode;
  children: ReactNode | ((data: T) => ReactNode);
}) {
  if (loading && !data) return <>{skeleton ?? <div className="space-y-3"><div className="h-24 animate-pulse rounded-lg bg-sunken" /><div className="h-24 animate-pulse rounded-lg bg-sunken" /></div>}</>;

  if (error && !data) {
    if (errorCode === 'network') return <NetworkState onRetry={onRetry} />;
    return <ErrorState description={error} onRetry={onRetry} />;
  }

  if (data === null) return <>{empty ?? null}</>;
  if (isEmpty?.(data)) return <>{empty ?? null}</>;

  return <>{typeof children === 'function' ? children(data) : children}</>;
}
