import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

type ToastVariant = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  /** Errors keep their retry affordance, if the caller supplies one. */
  action?: { label: string; onClick: () => void };
}

interface ToastContextValue {
  toast: (input: Omit<Toast, 'id'>) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string, action?: Toast['action']) => void;
  info: (title: string, description?: string) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastVariant, typeof Info> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
};

const ACCENTS: Record<ToastVariant, string> = {
  success: 'text-success',
  error: 'text-danger',
  info: 'text-brand',
  warning: 'text-warning',
};

/**
 * One notification system for the whole product (spec §97).
 * Toasts are throttled by id so the same event cannot spam the user.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (input: Omit<Toast, 'id'>) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => {
        // Never stack duplicates, and cap the visible stack.
        if (prev.some((t) => t.title === input.title && t.variant === input.variant)) return prev;
        return [...prev.slice(-3), { ...input, id }];
      });
      const ttl = input.variant === 'error' ? 7000 : 4200;
      window.setTimeout(() => dismiss(id), ttl);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      dismiss,
      success: (title, description) => toast({ title, description, variant: 'success' }),
      error: (title, description, action) => toast({ title, description, variant: 'error', action }),
      info: (title, description) => toast({ title, description, variant: 'info' }),
    }),
    [toast, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[90] flex flex-col items-center gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-end sm:px-6"
        role="region"
        aria-label="Notifications"
      >
        <div aria-live="polite" aria-atomic="false" className="flex w-full max-w-sm flex-col gap-2">
          {toasts.map((item) => {
            const Icon = ICONS[item.variant];
            return (
              <div
                key={item.id}
                className="pointer-events-auto flex animate-fade-up items-start gap-3 rounded-lg border border-line bg-elevated p-3 shadow-lift"
              >
                <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', ACCENTS[item.variant])} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-fg">{item.title}</p>
                  {item.description ? <p className="mt-0.5 text-xs text-muted">{item.description}</p> : null}
                  {item.action ? (
                    <button
                      type="button"
                      onClick={() => {
                        item.action?.onClick();
                        dismiss(item.id);
                      }}
                      className="mt-2 text-xs font-medium text-brand underline decoration-brand/30 underline-offset-2 hover:decoration-brand"
                    >
                      {item.action.label}
                    </button>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(item.id)}
                  className="rounded p-1 text-faint transition-colors hover:bg-sunken hover:text-fg"
                  aria-label="Dismiss notification"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context;
}
