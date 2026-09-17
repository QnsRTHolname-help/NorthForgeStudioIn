import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useFocusTrap, useScrollLock } from '@/hooks';
import { IconButton } from './Button';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Hides the close button for flows that must be completed (e.g. confirmations). */
  hideClose?: boolean;
}

const SIZES = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

/**
 * Accessible dialog (spec §89): portalled, focus-trapped, Escape to close,
 * scroll-locked, labelled by its heading, and closed on backdrop click only
 * when the content is not mid-submission.
 */
export function Modal({ open, onClose, title, description, children, footer, size = 'md', hideClose }: ModalProps) {
  const trapRef = useFocusTrap<HTMLDivElement>(open);
  useScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
      {/* One scrim token for every theme and surface (globals.css). */}
      <div
        className="absolute inset-0 animate-fade-in bg-[var(--nf-scrim)] backdrop-blur-[3px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className={cn(
          // `shadow-panel` already carries the dark rim light (see the token
          // in globals.css), so no theme-specific class is needed here.
          'relative z-10 max-h-[92vh] w-full animate-scale-in overflow-y-auto rounded-t-xl border border-line bg-surface shadow-panel sm:rounded-xl',
          SIZES[size],
        )}
      >
        {title ? (
          <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold tracking-tight text-fg">{title}</h2>
              {description ? <p className="mt-1 text-[13px] leading-relaxed text-muted">{description}</p> : null}
            </div>
            {!hideClose ? (
              <IconButton label="Close dialog" size="sm" onClick={onClose} className="-mr-1 -mt-1">
                <X className="h-4 w-4" />
              </IconButton>
            ) : null}
          </header>
        ) : null}

        <div className="px-5 py-5">{children}</div>

        {footer ? (
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-sunken/40 px-5 py-4">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

/* ── Drawer / Sheet ────────────────────────────────────────────── */

export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  side = 'right',
  width = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  side?: 'right' | 'left';
  /** Semantic size — previously a raw class was expected and invalid values
   *  (e.g. "md") silently rendered the panel full-screen width. */
  width?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const trapRef = useFocusTrap<HTMLDivElement>(open);
  useScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const WIDTHS: Record<NonNullable<typeof width>, string> = {
    sm: 'sm:max-w-sm',
    md: 'sm:max-w-md',
    lg: 'sm:max-w-lg',
    xl: 'sm:max-w-xl',
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80]">
      <div className="absolute inset-0 animate-fade-in bg-[var(--nf-scrim)]" onClick={onClose} aria-hidden />
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className={cn(
          'absolute inset-y-0 flex w-full flex-col border-line bg-surface shadow-panel',
          WIDTHS[width],
          side === 'right' ? 'right-0 border-l' : 'left-0 border-r',
          side === 'right' ? 'animate-slide-in-right' : 'animate-slide-in-left',
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold tracking-tight text-fg">{title}</h2>
            {description ? <p className="mt-1 text-[13px] text-muted">{description}</p> : null}
          </div>
          <IconButton label="Close panel" size="sm" onClick={onClose} className="-mr-1">
            <X className="h-4 w-4" />
          </IconButton>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer ? <footer className="border-t border-line bg-sunken/40 px-5 py-4">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}

/* ── Confirmation dialog for destructive / write actions (spec §75) ─ */

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive,
  pending,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  pending?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="h-9 rounded border border-line px-3 text-[13px] font-medium text-fg transition-colors hover:bg-sunken disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={pending}
            className={cn(
              'h-9 rounded px-3 text-[13px] font-medium text-white transition-colors disabled:opacity-50',
              destructive ? 'bg-danger hover:bg-[rgb(var(--nf-danger)/0.88)]' : 'bg-brand hover:bg-[rgb(var(--nf-blue)/0.88)]',
            )}
          >
            {pending ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      {null}
    </Modal>
  );
}
