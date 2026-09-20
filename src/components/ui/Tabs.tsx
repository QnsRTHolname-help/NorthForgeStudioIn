import { useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

/* ── Tabs (keyboard navigable, ARIA-complete) ──────────────────── */

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  content?: ReactNode;
}

export function Tabs({
  items,
  value,
  onChange,
  className,
  variant = 'underline',
}: {
  items: TabItem[];
  value?: string;
  onChange?: (id: string) => void;
  className?: string;
  variant?: 'underline' | 'pills';
}) {
  const [internal, setInternal] = useState(items[0]?.id ?? '');
  const active = value ?? internal;
  const setActive = onChange ?? setInternal;
  // DOM ids must come from position, not from the caller's `id`: those are
  // values ("overview", "Do I need a website?") and `aria-controls` is a
  // space-separated list, so a label with a space silently points at several
  // non-existent ids. `useId()` also returns colons, which are stripped here.
  const groupId = `nf-tabs-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const onKeyDown = (event: React.KeyboardEvent) => {
    const index = items.findIndex((item) => item.id === active);
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setActive(items[(index + 1) % items.length]?.id ?? active);
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setActive(items[(index - 1 + items.length) % items.length]?.id ?? active);
    }
    if (event.key === 'Home') {
      event.preventDefault();
      setActive(items[0]?.id ?? active);
    }
    if (event.key === 'End') {
      event.preventDefault();
      setActive(items[items.length - 1]?.id ?? active);
    }
  };

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label="Sections"
        onKeyDown={onKeyDown}
        className={cn(
          'nf-no-scrollbar flex gap-1 overflow-x-auto',
          variant === 'underline' && 'border-b border-line',
          variant === 'pills' && 'rounded bg-sunken p-1',
        )}
      >
        {items.map((item, index) => {
          const isActive = item.id === active;
          return (
            <button
              key={item.id}
              role="tab"
              id={`${groupId}-tab-${index}`}
              aria-selected={isActive}
              aria-controls={`${groupId}-panel-${index}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActive(item.id)}
              className={cn(
                'relative shrink-0 whitespace-nowrap px-3 py-2 text-[13px] font-medium transition-colors duration-150',
                variant === 'underline' &&
                  cn('-mb-px border-b-2', isActive ? 'border-brand text-fg' : 'border-transparent text-muted hover:text-fg'),
                variant === 'pills' &&
                  cn('rounded', isActive ? 'bg-elevated text-fg shadow-soft' : 'text-muted hover:text-fg'),
              )}
            >
              {item.label}
              {item.count !== undefined ? (
                <span className={cn('ml-1.5 nf-num text-xs', isActive ? 'text-brand' : 'text-faint')}>{item.count}</span>
              ) : null}
            </button>
          );
        })}
      </div>
      <div className="mt-5">
        {items.map((item, index) => (
          <div
            key={item.id}
            role="tabpanel"
            id={`${groupId}-panel-${index}`}
            aria-labelledby={`${groupId}-tab-${index}`}
            hidden={item.id !== active}
          >
            {item.id === active ? item.content : null}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Segmented control ─────────────────────────────────────────── */

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
  className,
  ariaLabel,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  size?: 'sm' | 'md';
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn('inline-flex rounded border border-line bg-sunken p-0.5', className)}
    >
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            role="tab"
            aria-selected={isActive}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded transition-colors duration-150',
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-[13px]',
              isActive ? 'bg-elevated font-medium text-fg shadow-soft' : 'text-muted hover:text-fg',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── Accordion ─────────────────────────────────────────────────── */

export function Accordion({
  items,
  allowMultiple,
  className,
}: {
  items: { id: string; question: ReactNode; answer: ReactNode }[];
  allowMultiple?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState<string[]>(() => (items[0] ? [items[0].id] : []));
  // Position-derived ids, for the same reason as Tabs above: the FAQ passes
  // the question text as `id`, which contains spaces and a "?".
  const baseId = `nf-accordion-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const toggle = (id: string) => {
    setOpen((prev) => {
      if (prev.includes(id)) return prev.filter((item) => item !== id);
      return allowMultiple ? [...prev, id] : [id];
    });
  };

  return (
    <div className={cn('divide-y divide-line border-y border-line', className)}>
      {items.map((item, index) => {
        const isOpen = open.includes(item.id);
        const panelId = `${baseId}-panel-${index}`;
        const buttonId = `${baseId}-button-${index}`;
        return (
          <div key={item.id}>
            <h3>
              <button
                type="button"
                id={buttonId}
                onClick={() => toggle(item.id)}
                aria-expanded={isOpen}
                aria-controls={panelId}
                className="group flex w-full items-start justify-between gap-6 py-5 text-left"
              >
                <span className={cn('text-[15px] font-medium transition-colors', isOpen ? 'text-fg' : 'text-fg/90 group-hover:text-brand')}>
                  {item.question}
                </span>
                <ChevronDown
                  className={cn(
                    'mt-0.5 h-4 w-4 shrink-0 text-faint transition-transform duration-300 ease-forge',
                    isOpen && 'rotate-180 text-brand',
                  )}
                  aria-hidden
                />
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              hidden={!isOpen}
              className="pb-5 pr-10"
            >
              <div className="text-[14px] leading-relaxed text-muted">{item.answer}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
