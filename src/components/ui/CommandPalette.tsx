import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { CornerDownLeft, Plus, Search } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useHotkey, useScrollLock } from '@/hooks';
import { insightsService, type SearchResult } from '@/services';
import { useAuth } from '@/app/providers/AuthProvider';
import { Spinner } from './Loader';
import { useDebounce } from '@/hooks';

interface CommandPaletteValue {
  open: (mode?: 'search' | 'create') => void;
  close: () => void;
}

const CommandPaletteContext = createContext<CommandPaletteValue | null>(null);

interface QuickAction {
  id: string;
  label: string;
  group: string;
  to: string;
  adminOnly?: boolean;
}

const QUICK_ACTIONS: QuickAction[] = [
  { id: 'lead', label: 'New lead', group: 'Create', to: '/app/leads?new=1', adminOnly: true },
  { id: 'client', label: 'New client', group: 'Create', to: '/app/clients?new=1', adminOnly: true },
  { id: 'task', label: 'New task', group: 'Create', to: '/app/tasks?new=1', adminOnly: true },
  { id: 'project', label: 'New project', group: 'Create', to: '/app/projects?new=1', adminOnly: true },
  { id: 'invoice', label: 'New invoice', group: 'Create', to: '/app/invoices?new=1', adminOnly: true },
  { id: 'booking', label: 'New appointment', group: 'Create', to: '/app/bookings?new=1', adminOnly: true },
  { id: 'request', label: 'New request', group: 'Create', to: '/portal/requests?new=1' },
  { id: 'workflow', label: 'New workflow', group: 'Create', to: '/app/workflows?new=1', adminOnly: true },
];

const NAV_TARGETS: QuickAction[] = [
  { id: 'nav-leads', label: 'Leads', group: 'Go to', to: '/app/leads', adminOnly: true },
  { id: 'nav-pipeline', label: 'Pipeline', group: 'Go to', to: '/app/pipeline', adminOnly: true },
  { id: 'nav-clients', label: 'Clients', group: 'Go to', to: '/app/clients', adminOnly: true },
  { id: 'nav-projects', label: 'Projects', group: 'Go to', to: '/app/projects', adminOnly: true },
  { id: 'nav-tasks', label: 'Tasks', group: 'Go to', to: '/app/tasks', adminOnly: true },
  { id: 'nav-workflows', label: 'Workflows', group: 'Go to', to: '/app/workflows', adminOnly: true },
  { id: 'nav-billing', label: 'Billing', group: 'Go to', to: '/app/invoices', adminOnly: true },
  { id: 'nav-health', label: 'System health', group: 'Go to', to: '/app/system-health', adminOnly: true },
  { id: 'nav-p-overview', label: 'My overview', group: 'Go to', to: '/portal' },
  { id: 'nav-p-leads', label: 'My enquiries', group: 'Go to', to: '/portal/leads' },
  { id: 'nav-p-analytics', label: 'My analytics', group: 'Go to', to: '/portal/analytics' },
  { id: 'nav-p-website', label: 'My website', group: 'Go to', to: '/portal/website' },
  { id: 'nav-p-support', label: 'Support', group: 'Go to', to: '/portal/support' },
];

/**
 * Global search + quick create (spec §72, §73).
 *
 * Cmd/Ctrl+K opens search, Cmd/Ctrl+N (or typing "create") opens quick
 * create. Results come from the same scoped search endpoint the API uses,
 * so a client can never surface another client's records here either.
 */
export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'search' | 'create'>('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const navigate = useNavigate();
  const { isAdmin, status } = useAuth();
  const debounced = useDebounce(query, 220);
  const listRef = useRef<HTMLDivElement>(null);

  useScrollLock(open);

  const openPalette = useCallback((next: 'search' | 'create' = 'search') => {
    setMode(next);
    setOpen(true);
    setQuery('');
    setActiveIndex(0);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  useHotkey('k', (event) => {
    event.preventDefault();
    setOpen((v) => {
      if (!v) setMode('search');
      return true;
    });
  });

  useHotkey('n', (event) => {
    event.preventDefault();
    if (status === 'authenticated') openPalette('create');
  });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      if (debounced.trim().length < 2) {
        setResults([]);
        setSearching(false);
        return;
      }
      setSearching(true);
      try {
        const data = await insightsService.search(debounced.trim(), controller.signal);
        if (!cancelled) setResults(data.results);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [debounced, open]);

  const actions = useMemo(() => {
    const pool = mode === 'create' ? QUICK_ACTIONS : [...QUICK_ACTIONS.slice(0, 3), ...NAV_TARGETS];
    const visible = pool.filter((action) => !action.adminOnly || isAdmin);
    if (!query.trim()) return visible;
    return visible.filter((action) => action.label.toLowerCase().includes(query.toLowerCase()));
  }, [mode, query, isAdmin]);

  const items = useMemo(() => {
    const resultItems = results.map((result) => ({
      id: `result-${result.type}-${result.id}`,
      label: result.title,
      group: result.type,
      to: result.href,
      subtitle: result.subtitle,
    }));
    return [...resultItems, ...actions.map((a) => ({ ...a, subtitle: a.group }))];
  }, [results, actions]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, mode, open]);

  const run = useCallback(
    (item: (typeof items)[number]) => {
      if (!item) return;
      navigate(item.to);
      close();
    },
    [navigate, close],
  );

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((i) => (i + 1) % Math.max(1, items.length));
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((i) => (i - 1 + items.length) % Math.max(1, items.length));
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        run(items[activeIndex]!);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, items, activeIndex, run, close]);

  // Keep the highlighted row in view during keyboard navigation.
  useEffect(() => {
    if (!open) return;
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    node?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  const value = useMemo(() => ({ open: openPalette, close }), [openPalette, close]);

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      {open
        ? createPortal(
            <div className="fixed inset-0 z-[95] flex items-start justify-center px-4 pt-[12vh]">
              <div className="absolute inset-0 animate-fade-in bg-[var(--nf-scrim)] backdrop-blur-[3px]" onClick={close} aria-hidden />
              <div
                role="dialog"
                aria-modal="true"
                aria-label={mode === 'create' ? 'Quick create' : 'Search NorthForge'}
                className="relative z-10 w-full max-w-xl animate-scale-in overflow-hidden rounded-xl border border-line bg-elevated shadow-panel"
              >
                <div className="flex items-center gap-3 border-b border-line px-4">
                  {mode === 'create' ? (
                    <Plus className="h-4 w-4 shrink-0 text-faint" aria-hidden />
                  ) : (
                    <Search className="h-4 w-4 shrink-0 text-faint" aria-hidden />
                  )}
                  <input
                    autoFocus
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={mode === 'create' ? 'Create…' : 'Search clients, leads, projects, invoices…'}
                    className="h-14 w-full bg-transparent text-[15px] text-fg placeholder:text-faint focus:outline-none"
                    aria-label="Search"
                  />
                  <kbd className="hidden shrink-0 rounded border border-line px-1.5 py-0.5 font-mono text-2xs text-faint sm:block">ESC</kbd>
                </div>

                <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
                  {searching ? (
                    <div className="flex items-center gap-2 px-3 py-6 text-[13px] text-faint">
                      <Spinner className="h-3.5 w-3.5" /> Searching…
                    </div>
                  ) : items.length === 0 ? (
                    <p className="px-3 py-8 text-center text-[13px] text-faint">
                      {query.trim().length < 2 && mode === 'search'
                        ? 'Type at least two characters to search.'
                        : 'No matches.'}
                    </p>
                  ) : (
                    items.map((item, index) => (
                      <button
                        key={item.id}
                        type="button"
                        data-index={index}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => run(item)}
                        className={cn(
                          'flex w-full items-center justify-between gap-4 rounded px-3 py-2.5 text-left transition-colors',
                          index === activeIndex ? 'bg-sunken' : 'hover:bg-sunken/60',
                        )}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-medium text-fg">{item.label}</span>
                          {item.subtitle ? (
                            <span className="block truncate text-xs capitalize text-faint">{item.subtitle}</span>
                          ) : null}
                        </span>
                        {index === activeIndex ? <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-faint" aria-hidden /> : null}
                      </button>
                    ))
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-2xs text-faint">
                  <span>↑ ↓ to navigate · ↵ to open</span>
                  <span className="hidden sm:block">⌘K search · ⌘N create</span>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </CommandPaletteContext.Provider>
  );
}

export function useCommandPalette() {
  const context = useContext(CommandPaletteContext);
  if (!context) throw new Error('useCommandPalette must be used inside CommandPaletteProvider');
  return context;
}
