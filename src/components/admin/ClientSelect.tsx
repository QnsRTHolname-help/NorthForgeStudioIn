import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Check, ChevronDown, Users } from 'lucide-react';
import { Field } from '@/components/ui/Form';
import { useAsync } from '@/hooks/useAsync';
import { clientsService } from '@/services';
import { cn } from '@/lib/cn';

/**
 * Searchable client picker for admin forms.
 *
 * The legacy forms used a plain <select> fed by a fixed ≤200-item preload,
 * so the target client could be missing, unreachable, or the dropdown just
 * looked empty. This component searches the database by name (RLS-scoped
 * for admins) on every keystroke and shows explicit loading / empty /
 * error states instead of silently hiding options.
 */
export function ClientSelect({
  label = 'Client',
  value,
  onChange,
  placeholder = 'Search clients…',
  required,
}: {
  label?: string;
  value: string;
  onChange: (clientId: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const state = useAsync(
    () => clientsService.list({ q: query.trim() || undefined, pageSize: 50 }),
    [query],
    { enabled: open },
  );
  const items = useMemo(() => state.data?.items ?? [], [state.data]);

  useEffect(() => {
    if (!value) {
      setSelectedName(null);
      return;
    }
    const found = items.find((client) => client.id === value);
    if (found) setSelectedName(found.businessName);
  }, [value, items]);

  // Close the list when clicking anywhere outside the control.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const pick = (id: string, name: string) => {
    onChange(id);
    setSelectedName(name);
    setQuery('');
    setOpen(false);
  };

  return (
    <div className="relative">
      <Field label={label} required={required}>
        <div ref={rootRef}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={cn(
              'flex h-10 w-full items-center gap-2 rounded border border-line bg-surface pl-3 pr-9 text-left text-sm text-fg transition-colors duration-150 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25',
            )}
            aria-haspopup="listbox"
            aria-expanded={open}
          >
            <span className={cn('flex-1 truncate', !selectedName && 'text-faint')}>
              {selectedName ?? placeholder}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-faint transition-transform" aria-hidden />
          </button>

          {open ? (
            <div className="absolute z-40 mt-1 w-full overflow-hidden rounded-lg border border-line bg-surface shadow-xl">
              <div className="relative border-b border-line">
                <Users className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" aria-hidden />
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by name or email…"
                  className="h-9 w-full rounded-none border-0 pl-9 pr-3 text-sm text-fg placeholder:text-faint focus:outline-none"
                  role="combobox"
                  aria-expanded={open}
                />
              </div>

              <ul role="listbox" className="max-h-56 overflow-y-auto py-1">
                {items.map((client) => {
                  const active = client.id === value;
                  return (
                    <li key={client.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={active}
                        onClick={() => pick(client.id, client.businessName)}
                        className={cn(
                          'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] transition-colors',
                          active ? 'bg-brand/10 text-fg' : 'text-muted hover:bg-sunken/60 hover:text-fg',
                        )}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-fg">{client.businessName}</span>
                          <span className="block truncate text-xs text-faint">{client.contactName}</span>
                        </span>
                        {active ? <Check className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden /> : null}
                      </button>
                    </li>
                  );
                })}

                {!state.loading && items.length === 0 ? (
                  <li className="px-3 py-3">
                    <p className="flex items-center gap-1.5 text-xs text-faint">
                      <Users className="h-3.5 w-3.5" aria-hidden />
                      {query.trim()
                        ? 'No clients match that search.'
                        : 'No clients yet — create one under Clients first.'}
                    </p>
                  </li>
                ) : null}

                {state.error ? (
                  <li className="px-3 py-3">
                    <p className="flex items-center gap-1.5 text-xs text-danger" role="alert">
                      <AlertCircle className="h-3.5 w-3.5" aria-hidden />
                      {state.error}
                    </p>
                  </li>
                ) : null}
              </ul>
            </div>
          ) : null}
        </div>
      </Field>
    </div>
  );
}