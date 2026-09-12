import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useOnClickOutside } from '@/hooks';

/* ── Tooltip ───────────────────────────────────────────────────── */

export function Tooltip({
  content,
  children,
  side = 'top',
  className,
}: {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'right';
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <span
      className={cn('relative inline-flex', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span aria-describedby={open ? id : undefined} className="inline-flex">
        {children}
      </span>
      {open ? (
        <span
          role="tooltip"
          id={id}
          className={cn(
            'pointer-events-none absolute z-50 whitespace-nowrap rounded border border-line bg-elevated px-2 py-1 text-xs text-fg shadow-lift',
            side === 'top' && 'bottom-full left-1/2 mb-2 -translate-x-1/2',
            side === 'bottom' && 'top-full left-1/2 mt-2 -translate-x-1/2',
            side === 'right' && 'left-full top-1/2 ml-2 -translate-y-1/2',
          )}
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}

/* ── Dropdown menu ─────────────────────────────────────────────── */

export interface DropdownItem {
  id: string;
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

export function Dropdown({
  trigger,
  items,
  align = 'right',
  className,
  menuClassName,
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  items: DropdownItem[];
  align?: 'left' | 'right';
  className?: string;
  menuClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  useOnClickOutside(containerRef, () => setOpen(false), open);

  useEffect(() => {
    if (!open) setActiveIndex(-1);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {trigger({ open, toggle: () => setOpen((v) => !v) })}

      {open ? (
        <div
          role="menu"
          className={cn(
            'absolute z-50 mt-1 min-w-[180px] animate-scale-in overflow-hidden rounded-lg border border-line bg-elevated p-1 shadow-panel',
            align === 'right' ? 'right-0' : 'left-0',
            menuClassName,
          )}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActiveIndex((i) => (i + 1) % items.length);
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActiveIndex((i) => (i - 1 + items.length) % items.length);
            }
            if (event.key === 'Escape') close();
            if (event.key === 'Enter' && activeIndex >= 0) {
              event.preventDefault();
              items[activeIndex]?.onSelect();
              close();
            }
          }}
        >
          {items.map((item, index) => (
            <button
              key={item.id}
              role="menuitem"
              type="button"
              disabled={item.disabled}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => {
                item.onSelect();
                close();
              }}
              className={cn(
                'flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-[13px] transition-colors disabled:opacity-40',
                item.destructive ? 'text-danger hover:bg-danger/10' : 'text-fg hover:bg-sunken',
                index === activeIndex && !item.disabled && (item.destructive ? 'bg-danger/10' : 'bg-sunken'),
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
