import { Panel } from '@/components/ui/Card';
import { AsyncBoundary, EmptyState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Badge';
import { PortalHeader } from '@/components/portal/PortalHeader';
import { useAsync } from '@/hooks/useAsync';
import { usePageMeta } from '@/hooks/usePageMeta';
import { announcementsService } from '@/services';
import { formatDateTime } from '@/lib/format';
import type { Announcement } from '@/types';

const PRIORITY_TONE: Record<Announcement['priority'], 'success' | 'warning' | 'danger'> = {
  normal: 'success',
  high: 'warning',
  critical: 'danger',
};

/**
 * Announcements (spec §18). Published messages from the NorthForge team.
 * The database decides what appears here — an announcement addressed to
 * other clients, or one not yet published, never reaches this query (RLS).
 */
export default function Announcements() {
  usePageMeta({ title: 'Announcements', noIndex: true });
  const state = useAsync(() => announcementsService.list(), []);
  const items = state.data?.items ?? [];

  return (
    <div>
      <PortalHeader
        title="Announcements"
        description="Updates and notices from the NorthForge team."
      />

      <AsyncBoundary
        loading={state.loading}
        error={state.error}
        data={state.data}
        onRetry={() => state.refetch().catch(() => undefined)}
        empty={
          <EmptyState
            title="No announcements"
            description="Scheduled maintenance, product updates and notices will appear here."
          />
        }
      >
        {items.length ? (
          <div className="grid gap-3">
            {items.map((item) => (
              <Panel key={item.id} title={item.title}>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge tone={PRIORITY_TONE[item.priority]}>{item.priority === 'normal' ? 'Notice' : item.priority}</Badge>
                  <span className="text-2xs text-faint">{formatDateTime(item.startsAt)}</span>
                </div>
                <p className="text-[13px] leading-relaxed text-muted">{item.message}</p>
              </Panel>
            ))}
          </div>
        ) : null}
      </AsyncBoundary>
    </div>
  );
}
