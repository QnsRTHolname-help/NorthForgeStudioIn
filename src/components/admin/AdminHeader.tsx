import type { ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { DemoBadge } from '@/components/ui/Badge';
import { Breadcrumb } from '@/components/ui/Data';
import { Input, Select } from '@/components/ui/Form';

/** Admin page header (spec §115): operational language, dense but clear. */
export function AdminHeader({
  title,
  description,
  crumbs,
  action,
  demo,
  className,
}: {
  title: string;
  description?: string;
  crumbs?: { label: string; to?: string }[];
  action?: ReactNode;
  demo?: boolean;
  className?: string;
}) {
  return (
    <header className={cn('mb-6', className)}>
      {crumbs?.length ? (
        <div className="mb-2">
          <Breadcrumb items={crumbs} />
        </div>
      ) : null}
      {/*
        Three-row rhythm on narrow screens: eyebrow → heading → actions.
        The action slot is its own row below the description instead of
        wrapping beside it, so Add-style buttons never get squashed into a
        cramped side-by-side strip on mobile (or wrapped mid-label).
      */}
      <div className="flex flex-col gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-fg">{title}</h1>
            {demo ? <DemoBadge /> : null}
          </div>
          {description ? <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-muted">{description}</p> : null}
        </div>
        {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
      </div>
    </header>
  );
}

/** Standard list toolbar: search + filters + primary action. */
export function ListToolbar({
  search,
  onSearch,
  searchPlaceholder = 'Search…',
  filters,
  onCreate,
  createLabel = 'New',
  className,
}: {
  search: string;
  onSearch: (value: string) => void;
  searchPlaceholder?: string;
  filters?: {
    value: string;
    onChange: (value: string) => void;
    options: { value: string; label: string }[];
    label: string;
  }[];
  onCreate?: () => void;
  createLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn('mb-4 flex flex-col gap-3 sm:flex-row sm:items-center', className)}>
      <div className="sm:max-w-xs sm:flex-1">
        <Input
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          containerClassName="gap-0"
        />
      </div>

      {filters?.length ? (
        <div className="flex flex-wrap gap-2">
          {filters.map((filter) => (
            <div key={filter.label} className="w-[150px]">
              <Select
                value={filter.value}
                onChange={(event) => filter.onChange(event.target.value)}
                options={filter.options}
                aria-label={filter.label}
                containerClassName="gap-0"
              />
            </div>
          ))}
        </div>
      ) : null}

      {onCreate ? (
        <Button
          size="md"
          className="shrink-0 self-start sm:self-auto"
          iconLeft={<Plus className="h-3.5 w-3.5" />}
          onClick={onCreate}
        >
          {createLabel}
        </Button>
      ) : null}
    </div>
  );
}

/** Empty, bordered surface reused by every admin list. */
export function ListShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-lg border border-line bg-surface', className)}>{children}</div>
  );
}
