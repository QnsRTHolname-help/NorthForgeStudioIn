import { useMemo, useState } from 'react';
import { AlertTriangle, Check, ShieldCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Checkbox, Input } from '@/components/ui/Form';
import { cn } from '@/lib/cn';

/**
 * A destructive action behind a *verified* confirmation.
 *
 * The previous version was a bare text field: type the business name, press a
 * button that greyed out until the strings happened to match. It told the
 * person nothing about what they were about to lose, and a match was invisible
 * — you found out you had mistyped only when the button refused to work.
 *
 * This does three things instead:
 *
 *   1. States the consequence BEFORE the input, split into what is removed and
 *      what is kept. That split is the honest part: closing an account does
 *      not delete a financial record, and a confirmation screen that implies
 *      otherwise is the bug worth avoiding.
 *   2. Verifies character by character, so progress is visible rather than
 *      binary, and a wrong character is flagged at the position that is wrong.
 *   3. Requires an explicit acknowledgement when the caller supplies one, so
 *      the last step is a decision rather than a reflex.
 *
 * Accessibility: the character strip is decorative (`aria-hidden`); the real
 * control is the labelled input, and the match state is announced politely.
 */

export interface ConfirmPhraseProps {
  /** The exact text the person must type. Case and surrounding space ignored. */
  phrase: string;
  /** What this action removes, in plain language. */
  removed: string[];
  /** What survives it, and why. Never leave this empty — say "nothing". */
  kept: string[];
  /** Optional explicit acknowledgement that must be ticked. */
  acknowledgement?: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  pending?: boolean;
  error?: string | null;
  /** Rendered above the buttons when the action is not available. */
  blockedReason?: string | null;
}

export function ConfirmPhrase({
  phrase,
  removed,
  kept,
  acknowledgement,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  pending = false,
  error,
  blockedReason,
}: ConfirmPhraseProps) {
  const [typed, setTyped] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);

  const normalise = (value: string) => value.trim().toLowerCase();
  const matched = normalise(typed) === normalise(phrase);
  const acknowledgedOk = !acknowledgement || acknowledged;
  const ready = matched && acknowledgedOk && !pending && !blockedReason;

  /** Per-character feedback over the target phrase. */
  const cells = useMemo(() => {
    const target = [...phrase];
    return target.map((char, index) => {
      if (index >= typed.length) return { char, state: 'empty' as const };
      return { char, state: (typed[index] === char ? 'ok' : 'bad') as 'ok' | 'bad' };
    });
  }, [phrase, typed]);

  const correct = cells.filter((cell) => cell.state === 'ok').length;
  const progress = Math.round((correct / Math.max(phrase.length, 1)) * 100);

  return (
    <div className="rounded-xl border border-danger/30 bg-danger/[0.04] p-4 sm:p-5">
      {/* ── 1. What this actually does ─────────────────────────── */}
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-danger/12 text-danger">
          <AlertTriangle className="h-4 w-4" aria-hidden />
        </span>
        <p className="pt-0.5 text-[13px] font-semibold text-fg">
          This is permanent and cannot be undone from your side.
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-danger/25 bg-canvas/60 p-3">
          <p className="text-2xs font-semibold uppercase tracking-[0.09em] text-danger">Removed</p>
          <ul className="mt-2 space-y-1.5">
            {removed.map((item) => (
              <li key={item} className="flex items-start gap-2 text-[12px] leading-relaxed text-muted">
                <X className="mt-0.5 h-3 w-3 shrink-0 text-danger" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-line bg-canvas/60 p-3">
          <p className="text-2xs font-semibold uppercase tracking-[0.09em] text-muted">Kept</p>
          <ul className="mt-2 space-y-1.5">
            {kept.map((item) => (
              <li key={item} className="flex items-start gap-2 text-[12px] leading-relaxed text-muted">
                <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-success" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── 2. Verification ────────────────────────────────────── */}
      <div className="mt-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[13px] text-fg">
            Type <span className="font-mono font-semibold text-danger">{phrase}</span> to verify it is you.
          </p>
          <p className="text-2xs tabular-nums text-faint">
            {correct} / {phrase.length} characters
          </p>
        </div>

        {/* Character strip: decorative, so the input below stays the control. */}
        <div className="mt-2 flex flex-wrap gap-1" aria-hidden>
          {cells.map((cell, index) => (
            <span
              key={`${cell.char}-${index}`}
              className={cn(
                'flex h-7 min-w-[1.1rem] items-center justify-center rounded border px-1 font-mono text-[13px] transition-colors duration-150',
                cell.state === 'ok' && 'border-success/50 bg-success/12 text-success',
                cell.state === 'bad' && 'border-danger bg-danger/15 text-danger',
                cell.state === 'empty' && 'border-line bg-surface text-faint',
              )}
            >
              {cell.char === ' ' ? '\u00b7' : cell.char}
            </span>
          ))}
        </div>

        <div className="mt-2 h-1 overflow-hidden rounded-full bg-line" aria-hidden>
          <div
            className={cn(
              'h-full rounded-full transition-[width] duration-200 ease-forge',
              matched ? 'bg-success' : 'bg-danger/70',
            )}
            style={{ width: `${progress}%` }}
          />
        </div>

        <Input
          className="mt-3 font-mono"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          placeholder={phrase}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-label={`Type ${phrase} to confirm`}
        />

        <p className="mt-1.5 min-h-[1rem] text-2xs" aria-live="polite">
          {typed.length === 0 ? (
            <span className="text-faint">Nothing has happened yet.</span>
          ) : matched ? (
            <span className="inline-flex items-center gap-1 text-success">
              <Check className="h-3 w-3" aria-hidden /> Matches. The button below is now armed.
            </span>
          ) : (
            <span className="text-muted">
              {typed.length > phrase.length
                ? 'That is longer than the phrase.'
                : 'Keep typing — spaces at the ends are ignored.'}
            </span>
          )}
        </p>
      </div>

      {/* ── 3. Acknowledgement ─────────────────────────────────── */}
      {acknowledgement ? (
        <div className="mt-3 rounded-lg border border-line bg-surface/60 p-3">
          <Checkbox checked={acknowledged} onChange={setAcknowledged} label={acknowledgement} />
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 text-xs text-danger">
          {error}
        </p>
      ) : null}
      {blockedReason ? <p className="mt-3 text-xs text-warning">{blockedReason}</p> : null}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-danger/20 pt-4">
        <Button variant="secondary" size="sm" onClick={onCancel} disabled={pending}>
          {cancelLabel}
        </Button>
        <Button
          variant="danger"
          size="sm"
          loading={pending}
          disabled={!ready}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}
