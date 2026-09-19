import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from 'react';
import { cn } from '@/lib/cn';

/**
 * Segmented one-time-code entry.
 *
 * A single text field with a letter-spaced monospace font works, but it reads
 * as a form to fill in rather than a code to confirm, and it gives no feedback
 * about how many digits have been entered. Boxes make the length obvious, make
 * a wrong digit obvious, and — the part that actually matters — let the screen
 * submit itself the moment the code is complete, so nobody has to
 * type six digits and then hunt for a button.
 *
 * Accessibility: one labelled input per digit inside a labelled group. The
 * auto-submit is announced by the surrounding form's own status text, not by
 * silently firing.
 */

export interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Called once when every digit is filled. */
  onComplete?: (value: string) => void;
  length?: number;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
  label?: string;
}

export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled = false,
  invalid = false,
  autoFocus = false,
  label = 'Authentication code',
}: OtpInputProps) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  /** Guards against firing onComplete twice for the same completed code. */
  const submitted = useRef<string | null>(null);

  const digits = Array.from({ length }, (_, index) => value[index] ?? '');

  useEffect(() => {
    if (autoFocus) inputs.current[0]?.focus();
  }, [autoFocus]);

  useEffect(() => {
    if (value.length !== length) {
      submitted.current = null;
      return;
    }
    if (submitted.current === value) return;
    submitted.current = value;
    onComplete?.(value);
  }, [value, length, onComplete]);

  const focusAt = (index: number) => {
    const target = inputs.current[Math.max(0, Math.min(index, length - 1))];
    target?.focus();
    target?.select();
  };

  /** Writes the digits of `next` and leaves the caret after the last one. */
  const write = (next: string, from: number) => {
    const characters = next.replace(/\D/g, '').slice(0, length - from).split('');
    if (characters.length === 0) return;
    const current = value.split('');
    characters.forEach((character, offset) => {
      current[from + offset] = character;
    });
    const combined = current.join('').slice(0, length);
    onChange(combined);
    focusAt(from + characters.length);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (event.key === 'Backspace') {
      event.preventDefault();
      const current = value.split('');
      if (current[index]) {
        // Clear this box but stay put — the natural first press.
        current[index] = '';
        onChange(current.join('').replace(/\s/g, ''));
      } else {
        // Already empty: step back and clear the previous box.
        current[index - 1] = '';
        onChange(current.join('').replace(/\s/g, ''));
        focusAt(index - 1);
      }
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusAt(index - 1);
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusAt(index + 1);
    }
  };

  const onPaste = (event: ClipboardEvent<HTMLInputElement>, index: number) => {
    const pasted = event.clipboardData.getData('text');
    if (!pasted || !/\d/.test(pasted)) return;
    event.preventDefault();
    write(pasted.trim(), index);
  };

  return (
    <div>
      <span id={`${label}-label`} className="block text-[13px] font-medium text-fg">
        {label}
      </span>
      <div
        role="group"
        aria-labelledby={`${label}-label`}
        aria-invalid={invalid || undefined}
        className="mt-2 flex gap-2"
      >
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(element) => {
              inputs.current[index] = element;
            }}
            value={digit}
            disabled={disabled}
            inputMode="numeric"
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            aria-label={`Digit ${index + 1} of ${length}`}
            maxLength={1}
            onChange={(event) => {
              const raw = event.target.value.replace(/\D/g, '');
              if (!raw) {
                const current = value.split('');
                current[index] = '';
                onChange(current.join('').replace(/\s/g, ''));
                return;
              }
              // Typing over a filled box, or a multi-character autofill burst.
              write(raw, index);
            }}
            onKeyDown={(event) => onKeyDown(event, index)}
            onPaste={(event) => onPaste(event, index)}
            onFocus={(event) => event.target.select()}
            className={cn(
              'h-12 w-11 rounded-lg border bg-surface text-center font-mono text-lg text-fg tabular-nums',
              'transition-colors duration-150 outline-none',
              'focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/40',
              'disabled:opacity-50',
              invalid ? 'border-danger' : digit ? 'border-line-strong' : 'border-line',
            )}
          />
        ))}
      </div>
    </div>
  );
}
