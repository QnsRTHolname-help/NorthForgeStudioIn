import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Skeleton } from './Loader';
import { EmptyState } from './States';

/* ── Primitives ────────────────────────────────────────────────── */

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('nf-scroll-x w-full', className)}>
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  // The header row needs to read as a distinct band in BOTH themes: on the
  // dark canvas a 40% wash of the sunken fill was indistinguishable from the
  // rows below it.
  return <thead className="border-b border-line bg-sunken/60">{children}</thead>;
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-line">{children}</tbody>;
}

export function TR({ children, onClick, className }: { children: ReactNode; onClick?: () => void; className?: string }) {
  return (
    <tr
      onClick={onClick}
      className={cn('transition-colors duration-150', onClick && 'cursor-pointer hover:bg-sunken/70', className)}
    >
      {children}
    </tr>
  );
}

export function TH({
  children,
  className,
  sortable,
  sortDirection,
  onSort,
  align = 'left',
}: {
  children: ReactNode;
  className?: string;
  sortable?: boolean;
  sortDirection?: 'asc' | 'desc' | null;
  onSort?: () => void;
  align?: 'left' | 'right' | 'center';
}) {
  const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';

  if (sortable) {
    return (
      <th scope="col" className={cn('px-4 py-3', alignClass)} aria-sort={sortDirection ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
        <button
          type="button"
          onClick={onSort}
          className={cn(
            'inline-flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wider transition-colors hover:text-fg',
            sortDirection ? 'text-fg' : 'text-faint',
          )}
        >
          {children}
          {sortDirection === 'asc' ? (
            <ArrowUp className="h-3 w-3" />
          ) : sortDirection === 'desc' ? (
            <ArrowDown className="h-3 w-3" />
          ) : (
            <ChevronsUpDown className="h-3 w-3 opacity-50" />
          )}
        </button>
      </th>
    );
  }

  return (
    <th scope="col" className={cn('px-4 py-3 text-2xs font-medium uppercase tracking-wider text-faint', alignClass, className)}>
      {children}
    </th>
  );
}

export function TD({ children, className, align = 'left' }: { children: ReactNode; className?: string; align?: 'left' | 'right' | 'center' }) {
  return (
    <td
      className={cn(
        'px-4 py-3 align-middle text-[13px] text-fg',
        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left',
        className,
      )}
    >
      {children}
    </td>
  );
}

/* ── DataTable ─────────────────────────────────────────────────── */

export interface Column<T> {
  key: string;
  header: string;
  /** Text-only renderer used for the mobile card layout. */
  cell: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  align?: 'left' | 'right' | 'center';
  className?: string;
  /** Hide on narrow screens (the mobile card layout still shows it). */
  hideBelow?: 'sm' | 'md' | 'lg';
}

/**
 * One table component for the whole product (spec §143).
 * Desktop renders a real table; below `md` it switches to a card list so
 * nothing ever overflows the viewport.
 */
export function DataTable<T extends { id: string }>({
  columns,
  rows,
  loading,
  onRowClick,
  sort,
  onSortChange,
  empty,
  rowActions,
  keyExtractor,
}: {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  onRowClick?: (row: T) => void;
  sort?: { key: string; direction: 'asc' | 'desc' } | null;
  onSortChange?: (sort: { key: string; direction: 'asc' | 'desc' }) => void;
  empty?: ReactNode;
  rowActions?: (row: T) => ReactNode;
  keyExtractor?: (row: T) => string;
}) {
  const hiddenClasses = { sm: 'hidden sm:table-cell', md: 'hidden md:table-cell', lg: 'hidden lg:table-cell' };

  if (loading) {
    return (
      <div className="space-y-2 p-4" aria-busy>
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return <div className="p-4">{empty ?? <EmptyState compact title="Nothing here yet" />}</div>;
  }

  return (
    <>
      {/* Desktop / tablet */}
      <div className="hidden nf-scroll-x md:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="border-b border-line bg-sunken/40">
            <tr>
              {columns.map((column) => (
                <TH
                  key={column.key}
                  align={column.align}
                  className={column.hideBelow ? hiddenClasses[column.hideBelow] : undefined}
                  sortable={Boolean(column.sortValue && onSortChange)}
                  sortDirection={sort?.key === column.key ? sort.direction : null}
                  onSort={
                    column.sortValue && onSortChange
                      ? () =>
                          onSortChange({
                            key: column.key,
                            direction: sort?.key === column.key && sort.direction === 'asc' ? 'desc' : 'asc',
                          })
                      : undefined
                  }
                >
                  {column.header}
                </TH>
              ))}
              {rowActions ? <TH align="right">Actions</TH> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => (
              <tr
                key={keyExtractor?.(row) ?? row.id}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn('transition-colors duration-150', onRowClick && 'cursor-pointer hover:bg-sunken/60')}
              >
                {columns.map((column) => (
                  <TD
                    key={column.key}
                    align={column.align}
                    className={cn(column.className, column.hideBelow && hiddenClasses[column.hideBelow])}
                  >
                    {column.cell(row)}
                  </TD>
                ))}
                {rowActions ? (
                  <TD align="right" className="whitespace-nowrap">
                    {/* Swallow clicks so an action button inside a clickable
                        row never also triggers the row's own navigation. */}
                    <div
                      className="inline-flex items-center gap-1.5"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {rowActions(row)}
                    </div>
                  </TD>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile — card list, never a squeezed table (spec §143) */}
      <ul className="divide-y divide-line md:hidden">
        {rows.map((row) => (
          <li
            key={keyExtractor?.(row) ?? row.id}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={cn('px-4 py-3', onRowClick && 'cursor-pointer active:bg-sunken/60')}
          >
            <dl className="space-y-1.5">
              {columns.map((column) => (
                <div key={column.key} className="flex items-start justify-between gap-4">
                  <dt className="shrink-0 text-2xs uppercase tracking-wider text-faint">{column.header}</dt>
                  <dd className="min-w-0 text-right text-[13px] text-fg">{column.cell(row)}</dd>
                </div>
              ))}
              {rowActions ? (
                <div className="pt-1 text-right" onClick={(event) => event.stopPropagation()}>
                  {rowActions(row)}
                </div>
              ) : null}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
