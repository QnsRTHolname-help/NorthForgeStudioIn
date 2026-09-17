import { useMemo } from 'react';
import { Check, X } from 'lucide-react';
import { scorePassword, PASSWORD_POLICY } from '@shared/password';
import { cn } from '@/lib/cn';

const LEVEL_LABEL = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'] as const;
const LEVEL_COLOR = ['bg-danger', 'bg-danger', 'bg-warning', 'bg-success', 'bg-success'] as const;

/**
 * Live password strength meter driven by the SHARED policy
 * (`shared/password.ts`) — the same scorer the API enforces, so the meter
 * can never approve a password the server will reject.
 *
 * Shows a 5-segment bar, a level label, and the concrete checklist
 * (length / cases / number / symbol) so users know exactly what to fix.
 */
export function PasswordStrength({ password }: { password: string }) {
  const result = useMemo(() => scorePassword(password), [password]);

  if (!password) return null;

  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1" aria-hidden>
        {[0, 1, 2, 3, 4].map((segment) => (
          <span
            key={segment}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors duration-200',
              segment <= result.level && result.level > 0 ? LEVEL_COLOR[result.level] : 'bg-line',
            )}
          />
        ))}
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-2">
        <p className="text-2xs font-medium text-muted">{LEVEL_LABEL[result.level]}</p>
        {result.accepted ? (
          <p className="text-2xs text-success">Meets the security policy</p>
        ) : (
          <p className="text-2xs text-faint">Min {PASSWORD_POLICY.minLength} characters</p>
        )}
      </div>

      {result.issues.length > 0 && (
        <ul className="mt-1.5 space-y-0.5">
          {result.issues.slice(0, 2).map((issue) => (
            <li key={issue.code} className="flex items-start gap-1.5 text-2xs text-warning">
              <X className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
              {issue.message}
            </li>
          ))}
        </ul>
      )}

      <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
        {[
          { ok: result.checks.length, label: `${PASSWORD_POLICY.minLength}+ chars` },
          { ok: result.checks.upper && result.checks.lower, label: 'Upper & lower' },
          { ok: result.checks.digit, label: 'Number' },
          { ok: result.checks.symbol, label: 'Symbol' },
        ].map((item) => (
          <li
            key={item.label}
            className={cn('flex items-center gap-1.5 text-2xs', item.ok ? 'text-success' : 'text-faint')}
          >
            {item.ok ? <Check className="h-3 w-3 shrink-0" aria-hidden /> : <X className="h-3 w-3 shrink-0" aria-hidden />}
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
