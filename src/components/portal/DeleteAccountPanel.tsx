import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { Panel } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/app/providers/AuthProvider';
import { useToast } from '@/app/providers/ToastProvider';
import { useMutation } from '@/hooks/useAsync';
import { ERASURE_WINDOW, ERASED_ITEMS, KEPT_ITEMS, STANDARD_DELETION_NOTICE } from '@/config/deleteAccount';

export interface DeleteAccountPanelProps {
  startOpen?: boolean;
  onWipeData?: () => Promise<void> | void;
}

/**
 * Delete my account / wipe data flow (Milestone 3 / R3).
 *
 * Prominently states that standard account deletion completes in 6 business days.
 * When the trigger button is clicked, an accessible confirmation dialog/modal is shown
 * with a prominent "Wipe Data" button.
 *
 * Clicking "Wipe Data" immediately executes the wipe data flow:
 * 1. Invokes useAuth().deleteAccount(), which calls authService.deleteAccount() and
 *    executes PostgreSQL RPC app_delete_own_account() (cascading the client workspace,
 *    files, tasks, leads, and removing auth.users).
 * 2. Purges data across Supabase and the browser (sessionStorage, localStorage auth tokens).
 * 3. Logs out cleanly with toast feedback.
 */
export function DeleteAccountPanel({ startOpen = false, onWipeData }: DeleteAccountPanelProps) {
  const toast = useToast();
  const { deleteAccount } = useAuth();
  const [showConfirm, setShowConfirm] = useState(startOpen);
  const [error, setError] = useState<string | null>(null);

  const del = useMutation(
    async () => {
      await deleteAccount();
      // Defensively purge client storage across the browser
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.clear();
          for (const key of Object.keys(localStorage)) {
            if (key.startsWith('nf.') || key.startsWith('sb-') || key.includes('auth-token')) {
              localStorage.removeItem(key);
            }
          }
        } catch {
          // Ignore storage restrictions if in private browsing
        }
      }
    },
    {
      onSuccess: () => {
        toast.info(
          'Account closed',
          `Your workspace has been erased. Standard account deletion completes within ${ERASURE_WINDOW}. Anything required for tax/accounting records is retained as required by law.`,
        );
        setShowConfirm(false);
      },
    },
  );

  useEffect(() => {
    if (!showConfirm) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !del.pending) {
        setShowConfirm(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showConfirm, del.pending]);

  const handleWipeData = async () => {
    setError(null);
    try {
      if (onWipeData) {
        await onWipeData();
        setShowConfirm(false);
      } else {
        await del.mutate();
      }
    } catch (err) {
      setError((err as Error)?.message ?? 'We could not delete your account right now. Please try again or contact support.');
    }
  };

  return (
    <Panel title="Delete my account" className="border-danger/30">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />
        <div className="min-w-0">
          <p className="text-[13px] leading-relaxed text-muted">
            This closes your NorthForge account permanently and erases your workspace — every lead, project, task, file,
            request and message. Standard account deletion completes in{' '}
            <strong className="font-semibold text-fg">{ERASURE_WINDOW}</strong>.
          </p>
          <p className="mt-1 text-xs text-faint">
            {STANDARD_DELETION_NOTICE}
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            Closing your account is not the same as cancelling your plan. If your subscription is still active,{' '}
            <Link to="/portal/subscription" className="text-brand hover:underline">
              cancel it first
            </Link>{' '}
            so billing stops cleanly.
          </p>
        </div>
      </div>

      <div className="mt-4">
        <Button
          variant="secondary"
          size="sm"
          className="border-danger/40 text-danger hover:border-danger hover:text-danger"
          iconLeft={<Trash2 className="h-3.5 w-3.5" />}
          data-testid="delete-account-trigger"
          onClick={() => {
            setError(null);
            setShowConfirm(true);
          }}
        >
          Delete my account…
        </Button>
      </div>

      {showConfirm ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="wipe-data-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget && !del.pending) {
              setShowConfirm(false);
            }
          }}
          data-testid="delete-account-dialog"
        >
          <div className="relative w-full max-w-lg rounded-xl border border-danger/30 bg-surface p-6 shadow-2xl animate-scale-in">
            <div className="flex items-start justify-between gap-4 border-b border-line pb-4">
              <div className="flex items-center gap-2 text-danger">
                <AlertTriangle className="h-5 w-5" aria-hidden />
                <h3 id="wipe-data-dialog-title" className="text-base font-semibold text-fg">
                  Confirm Account Deletion & Wipe Data
                </h3>
              </div>
              {!del.pending && (
                <button
                  type="button"
                  onClick={() => setShowConfirm(false)}
                  className="rounded p-1 text-muted hover:text-fg hover:bg-sunken"
                  aria-label="Close dialog"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <p className="text-[13px] font-medium text-fg">Wiping your data cannot be undone.</p>
                <p className="mt-1 text-[13px] leading-relaxed text-muted">
                  There is no restore and no backup we can hand back — the workspace is erased, not archived.
                  Standard account deletion completes in{' '}
                  <strong className="font-semibold text-fg">{ERASURE_WINDOW}</strong>.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-danger/20 bg-danger/[0.03] p-3">
                  <p className="nf-eyebrow mb-2 text-danger">{`Erased within ${ERASURE_WINDOW}`}</p>
                  <ul className="space-y-1 text-xs text-muted">
                    {ERASED_ITEMS.map((item) => (
                      <li key={item} className="flex gap-1.5">
                        <span aria-hidden className="font-bold text-danger">×</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg border border-line bg-surface p-3">
                  <p className="nf-eyebrow mb-2 text-success">Kept for compliance</p>
                  <ul className="space-y-1 text-xs text-muted">
                    {KEPT_ITEMS.map((item) => (
                      <li key={item} className="flex gap-1.5">
                        <span aria-hidden className="font-bold text-success">✓</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {error || del.error ? (
                <div className="rounded-lg border border-danger/30 bg-danger/[0.05] p-3 text-xs text-danger">
                  {error ?? del.error}
                </div>
              ) : null}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
              <Button
                variant="secondary"
                size="sm"
                disabled={del.pending}
                onClick={() => {
                  setShowConfirm(false);
                  setError(null);
                }}
              >
                Keep my account
              </Button>
              <Button
                variant="danger"
                size="sm"
                loading={del.pending}
                iconLeft={<Trash2 className="h-3.5 w-3.5" />}
                data-testid="wipe-data-button"
                onClick={handleWipeData}
              >
                Wipe Data
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </Panel>
  );
}