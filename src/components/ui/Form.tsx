import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { AlertCircle, Check, ChevronDown, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useState } from 'react';

/* ── Field wrapper: label + hint + error, wired for screen readers ── */

interface FieldProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}

export function Field({ label, hint, error, required, htmlFor, children, className }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label ? (
        <label htmlFor={htmlFor} className="text-[13px] font-medium text-fg">
          {label}
          {required ? <span className="ml-0.5 text-danger" aria-hidden> *</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="flex items-center gap-1.5 text-xs text-danger" role="alert">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-faint">{hint}</p>
      ) : null}
    </div>
  );
}

const CONTROL =
  'w-full rounded border border-line bg-surface text-sm text-fg placeholder:text-faint transition-colors duration-150 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-danger';

/* ── Input ─────────────────────────────────────────────────────── */

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  iconLeft?: ReactNode;
  containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, iconLeft, className, containerClassName, id, required, ...props },
  ref,
) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={inputId} className={containerClassName}>
      <div className="relative">
        {iconLeft ? (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" aria-hidden>
            {iconLeft}
          </span>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={cn(CONTROL, 'h-10 px-3', iconLeft && 'pl-9', error && 'border-danger', className)}
          {...props}
        />
      </div>
    </Field>
  );
});

/* ── Password input with visibility toggle (spec §31) ──────────── */

export const PasswordInput = forwardRef<HTMLInputElement, InputProps>(function PasswordInput(
  { label, hint, error, className, containerClassName, id, required, ...props },
  ref,
) {
  const generated = useId();
  const inputId = id ?? generated;
  const [visible, setVisible] = useState(false);

  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={inputId} className={containerClassName}>
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          type={visible ? 'text' : 'password'}
          required={required}
          aria-invalid={error ? true : undefined}
          className={cn(CONTROL, 'h-10 pl-3 pr-10', error && 'border-danger', className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center text-faint transition-colors hover:text-fg"
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </Field>
  );
});

/* ── Textarea ──────────────────────────────────────────────────── */

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
  containerClassName?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, className, containerClassName, id, required, rows = 4, ...props },
  ref,
) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={inputId} className={containerClassName}>
      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        className={cn(CONTROL, 'resize-y px-3 py-2 leading-relaxed', error && 'border-danger', className)}
        {...props}
      />
    </Field>
  );
});

/* ── Select ────────────────────────────────────────────────────── */

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  options: { value: string; label: string; disabled?: boolean }[];
  placeholder?: string;
  containerClassName?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, options, placeholder, className, containerClassName, id, required, ...props },
  ref,
) {
  const generated = useId();
  const selectId = id ?? generated;
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={selectId} className={containerClassName}>
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          required={required}
          aria-invalid={error ? true : undefined}
          className={cn(CONTROL, 'h-10 appearance-none pl-3 pr-9', error && 'border-danger', className)}
          {...props}
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" aria-hidden />
      </div>
    </Field>
  );
});

/* ── Checkbox ──────────────────────────────────────────────────── */

export function Checkbox({
  checked,
  onChange,
  label,
  description,
  disabled,
  id,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: string;
  disabled?: boolean;
  id?: string;
}) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <label htmlFor={inputId} className={cn('flex cursor-pointer items-start gap-2.5', disabled && 'cursor-not-allowed opacity-50')}>
      <span className="relative mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
        <input
          id={inputId}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden
          className={cn(
            'flex h-4 w-4 items-center justify-center rounded-[4px] border transition-colors duration-150',
            checked ? 'border-brand bg-brand text-white' : 'border-line-strong bg-surface',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-brand peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-canvas',
          )}
        >
          {checked ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
        </span>
      </span>
      <span className="min-w-0">
        <span className="block text-sm text-fg">{label}</span>
        {description ? <span className="mt-0.5 block text-xs text-faint">{description}</span> : null}
      </span>
    </label>
  );
}

/* ── Radio group ───────────────────────────────────────────────── */

export interface RadioOption<T extends string> {
  value: T;
  label: string;
  description?: string;
}

export function RadioGroup<T extends string>({
  value,
  onChange,
  options,
  name,
  columns = 1,
}: {
  value: T;
  onChange: (value: T) => void;
  options: RadioOption<T>[];
  name?: string;
  columns?: 1 | 2;
}) {
  const generatedName = useId();
  const groupName = name ?? generatedName;
  return (
    <div
      role="radiogroup"
      className={cn('grid gap-2', columns === 2 ? 'sm:grid-cols-2' : 'grid-cols-1')}
    >
      {options.map((option) => {
        const active = value === option.value;
        return (
          <label
            key={option.value}
            className={cn(
              'flex cursor-pointer items-start gap-2.5 rounded border p-3 transition-colors duration-150',
              active ? 'border-brand bg-brand/[0.06]' : 'border-line bg-surface hover:border-line-strong',
            )}
          >
            <input
              type="radio"
              name={groupName}
              value={option.value}
              checked={active}
              onChange={() => onChange(option.value)}
              className="peer sr-only"
            />
            <span
              aria-hidden
              className={cn(
                'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors',
                active ? 'border-brand' : 'border-line-strong',
                'peer-focus-visible:ring-2 peer-focus-visible:ring-brand peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-canvas',
              )}
            >
              {active ? <span className="h-2 w-2 rounded-full bg-brand" /> : null}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-fg">{option.label}</span>
              {option.description ? <span className="mt-0.5 block text-xs text-muted">{option.description}</span> : null}
            </span>
          </label>
        );
      })}
    </div>
  );
}

/* ── Switch ────────────────────────────────────────────────────── */

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-fg">{label}</p>
        {description ? <p className="mt-0.5 text-xs text-faint">{description}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ease-forge disabled:opacity-50',
          checked ? 'bg-brand' : 'bg-line-strong',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ease-forge',
            checked ? 'translate-x-[18px]' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
}

/* ── Inline form error summary ─────────────────────────────────── */

/**
 * A password form must carry a username field, or a browser cannot tell whose
 * password is being changed: Chrome logs an accessibility notice on the form
 * and password managers may offer to save the new password against the wrong
 * account. The signed-in address is already known here, so it is supplied
 * invisibly — no new input for the operator to fill in, nothing added to the
 * tab order, and nothing extra announced by a screen reader.
 */
export function HiddenUsername({ value }: { value: string }) {
  return (
    <input
      type="email"
      name="username"
      autoComplete="username"
      value={value}
      readOnly
      tabIndex={-1}
      aria-hidden="true"
      className="sr-only"
    />
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded border border-danger/30 bg-danger/[0.08] px-3 py-2 text-[13px] text-danger"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  );
}
