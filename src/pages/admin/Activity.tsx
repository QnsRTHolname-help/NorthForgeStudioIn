import { useState } from 'react';
import { Panel } from '@/components/ui/Card';
import { AsyncBoundary, EmptyState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Badge';
import { AdminHeader, ListToolbar } from '@/components/admin/AdminHeader';
import { Timeline } from '@/components/ui/Data';
import { useAsync } from '@/hooks/useAsync';
import { usePageMeta } from '@/hooks/usePageMeta';
import { insightsService } from '@/services';
import { formatDateTime, formatRelative } from '@/lib/format';

/**
 * Activity log (spec §113).
 * Append-only history of what the system did — the audit trail for
 * "who changed what and when".
 */
export default function Activity() {
  usePageMeta({ title: 'Activity', noIndex: true });
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState('40');

  const state = useAsync(() => insightsService.activity(Number(limit)), [limit]);
  const items = (state.data?.items ?? []).filter((entry) => {
    if (!query) return true;
    const needle = query.toLowerCase();
    return (
      entry.label.toLowerCase().includes(needle) ||
      (entry.detail ?? '').toLowerCase().includes(needle) ||
      entry.type.toLowerCase().includes(needle) ||
      entry.actor.toLowerCase().includes(needle)
    );
  });

  return (
    <div>
      <AdminHeader
        title="Activity"
        description="Everything the system has recorded, newest first."
        crumbs={[{ label: 'Activity' }]}
      />

      <ListToolbar
        search={query}
        onSearch={setQuery}
        searchPlaceholder="Search activity…"
        filters={[
          {
            label: 'Entries',
            value: limit,
            onChange: setLimit,
            options: [
              { value: '20', label: 'Last 20' },
              { value: '40', label: 'Last 40' },
              { value: '100', label: 'Last 100' },
            ],
          },
        ]}
      />

      <AsyncBoundary
        loading={state.loading}
        error={state.error}
        data={state.data}
        onRetry={() => state.refetch().catch(() => undefined)}
      >
        {items.length ? (
          <Panel title={`${items.length} event${items.length === 1 ? '' : 's'}`}>
            <Timeline
              items={items.map((entry) => ({
                id: entry.id,
                label: entry.label,
                detail: entry.detail ?? undefined,
                meta: (
                  <span className="flex flex-wrap items-center gap-2">
                    <Badge tone="neutral">{entry.type}</Badge>
                    <span>
                      {entry.actor} · {formatRelative(entry.createdAt)}
                    </span>
                  </span>
                ),
                state: 'done' as const,
              }))}
            />
            <p className="mt-6 border-t border-line pt-4 text-2xs text-faint">
              Timestamps are shown in your local timezone ({formatDateTime(items[0]!.createdAt)}).
            </p>
          </Panel>
        ) : (
          <EmptyState
            title="No activity matches"
            description="Try a different search, or increase the number of entries."
          />
        )}
      </AsyncBoundary>
    </div>
  );
}
