import { useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Paperclip, Upload, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { initials } from '@/lib/format';
import { Button } from './Button';

/* ── Avatar ────────────────────────────────────────────────────── */

export function Avatar({
  name,
  src,
  size = 'md',
  className,
}: {
  name: string | null;
  src?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizes = {
    xs: 'h-6 w-6 text-[10px]',
    sm: 'h-8 w-8 text-xs',
    md: 'h-9 w-9 text-[13px]',
    lg: 'h-12 w-12 text-base',
  };

  if (src) {
    return <img src={src} alt={name ?? ''} className={cn('rounded-full object-cover', sizes[size], className)} />;
  }

  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex items-center justify-center rounded-full border border-line bg-sunken font-medium uppercase text-muted',
        sizes[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

/* ── Pagination ────────────────────────────────────────────────── */

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
      <p className="nf-num text-xs text-faint">
        {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="inline-flex h-8 w-8 items-center justify-center rounded border border-line text-fg transition-colors hover:bg-sunken disabled:opacity-40"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="nf-num px-2 text-xs text-muted">
          {page} / {pageCount}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
          className="inline-flex h-8 w-8 items-center justify-center rounded border border-line text-fg transition-colors hover:bg-sunken disabled:opacity-40"
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* ── Breadcrumb ────────────────────────────────────────────────── */

export function Breadcrumb({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-faint">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="flex items-center gap-1.5">
          {index > 0 ? <span aria-hidden className="text-line-strong">/</span> : null}
          {item.to && index < items.length - 1 ? (
            <Link to={item.to} className="transition-colors hover:text-fg">
              {item.label}
            </Link>
          ) : (
            <span className={cn(index === items.length - 1 && 'text-muted')} aria-current={index === items.length - 1 ? 'page' : undefined}>
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}

/* ── Timeline ──────────────────────────────────────────────────── */

export function Timeline({
  items,
  className,
}: {
  items: { id: string; label: ReactNode; detail?: ReactNode; meta?: ReactNode; state?: 'done' | 'current' | 'upcoming' }[];
  className?: string;
}) {
  return (
    <ol className={cn('relative space-y-5', className)}>
      {items.map((item, index) => {
        const state = item.state ?? 'upcoming';
        const isLast = index === items.length - 1;
        return (
          <li key={item.id} className="relative flex gap-3.5">
            {!isLast ? (
              <span
                aria-hidden
                className={cn(
                  'absolute left-[7px] top-4 h-full w-px',
                  state === 'done' ? 'bg-brand/40' : 'bg-line',
                )}
              />
            ) : null}
            <span
              aria-hidden
              className={cn(
                'relative mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2',
                state === 'done' && 'border-brand bg-brand',
                state === 'current' && 'border-brand bg-surface',
                state === 'upcoming' && 'border-line-strong bg-surface',
              )}
            >
              {state === 'current' ? <span className="absolute inset-[3px] rounded-full bg-brand" /> : null}
            </span>
            <div className="min-w-0 flex-1 pb-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className={cn('text-[13px] font-medium', state === 'upcoming' ? 'text-muted' : 'text-fg')}>{item.label}</p>
                {item.meta ? <span className="nf-num text-xs text-faint">{item.meta}</span> : null}
              </div>
              {item.detail ? <div className="mt-1 text-[13px] leading-relaxed text-muted">{item.detail}</div> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ── Date picker ───────────────────────────────────────────────── */

export function DatePicker({
  label,
  value,
  onChange,
  min,
  error,
  hint,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  error?: string;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      {label ? <span className="text-[13px] font-medium text-fg">{label}</span> : null}
      <input
        type="date"
        value={value}
        min={min}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        className={cn(
          'h-10 w-full rounded border border-line bg-surface px-3 text-sm text-fg transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25',
          error && 'border-danger',
        )}
      />
      {error ? (
        <span className="text-xs text-danger" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="text-xs text-faint">{hint}</span>
      ) : null}
    </label>
  );
}

/* ── File upload (validated client-side; server re-validates) ──── */

export interface SelectedFile {
  name: string;
  size: number;
  type: string;
}

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'text/plain', 'text/csv'];

export function FileUpload({
  files,
  onChange,
  hint = 'PNG, JPG, PDF, CSV or TXT up to 5 MB.',
  disabled,
}: {
  files: SelectedFile[];
  onChange: (files: SelectedFile[]) => void;
  hint?: string;
  disabled?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (list: FileList | null) => {
    if (!list) return;
    const accepted: SelectedFile[] = [];
    for (const file of Array.from(list)) {
      // Validate type and size here for instant feedback; the API must
      // repeat these checks — client-side validation is not security.
      if (!ALLOWED.includes(file.type)) {
        setError(`${file.name}: unsupported file type.`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        setError(`${file.name}: larger than 5 MB.`);
        continue;
      }
      accepted.push({ name: file.name, size: file.size, type: file.type });
    }
    setError(null);
    if (accepted.length) onChange([...files, ...accepted]);
  };

  return (
    <div className="flex flex-col gap-2">
      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          if (!disabled) handleFiles(event.dataTransfer.files);
        }}
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line bg-sunken/40 px-4 py-6 text-center transition-colors',
          !disabled && 'hover:border-brand/40',
          disabled && 'opacity-50',
        )}
      >
        <Upload className="h-4 w-4 text-faint" aria-hidden />
        <p className="text-[13px] text-muted">Drag files here, or</p>
        <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()} disabled={disabled}>
          Choose files
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="sr-only"
          accept={ALLOWED.join(',')}
          disabled={disabled}
          onChange={(event) => {
            handleFiles(event.target.files);
            event.target.value = '';
          }}
        />
        <p className="text-xs text-faint">{hint}</p>
      </div>

      {error ? (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {files.length ? (
        <ul className="space-y-1.5">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex items-center justify-between gap-3 rounded border border-line bg-surface px-3 py-2 text-[13px]"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Paperclip className="h-3.5 w-3.5 shrink-0 text-faint" aria-hidden />
                <span className="truncate text-fg">{file.name}</span>
                <span className="nf-num shrink-0 text-xs text-faint">{(file.size / 1024).toFixed(0)} KB</span>
              </span>
              <button
                type="button"
                onClick={() => onChange(files.filter((_, i) => i !== index))}
                className="rounded p-1 text-faint transition-colors hover:bg-sunken hover:text-danger"
                aria-label={`Remove ${file.name}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
