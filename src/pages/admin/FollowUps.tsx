import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock } from 'lucide-react';
import { Panel } from '@/components/ui/Card';
import { AsyncBoundary, EmptyState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Badge';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Segmented } from '@/components/ui/Tabs';
import { useAsync } from '@/hooks/useAsync';
import { usePageMeta } from '@/hooks/usePageMeta';
import { leadsService } from '@/services';
import { formatDateTime, titleCase } from '@/lib/format';

/**
 * Follow-ups (spec §113).
 * Everything promised to a lead, in due-date order, with overdue first.
 */
export default function FollowUps() {
  usePageMeta({ title: 'Follow-ups', noIndex: true });
  const [view, setView] = useState<'open' | 'all'>('open');

  const state = useAsync(async () => {
    const result = await leadsService.list({ pageSize: 200 });
    return result;
  }, []);

  const leads = state.data?.items ?? [];

  const withNextAction = leads
    .filter((lead) => lead.nextAction && (view === 'all' || !['won', 'lost'].includes(lead.status)))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const overdue = withNextAction.filter((lead) => new Date(lead.createdAt) < new Date(Date.now() - 3 * 86400000));

  return (
    <div>
      <AdminHeader
        title="Follow-ups"
        description="Everything promised to a lead, with the oldest commitments first."
        crumbs={[{ label: 'Follow-ups' }]}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented
          value={view}
          onChange={(value) => setView(value as 'open' | 'all')}
          options={[
            { value: 'open', label: 'Open leads' },
            { value: 'all', label: 'All' },
          ]}
          size="sm"
          ariaLabel="Follow-up scope"
        />
        <span className="flex items-center gap-1.5 text-[13px] text-muted">
          <CalendarClock className="h-3.5 w-3.5 text-warning" aria-hidden />
          {overdue.length} open for more than 3 days
        </span>
      </div>

      <AsyncBoundary
        loading={state.loading}
        error={state.error}
        data={state.data}
        onRetry={() => state.refetch().catch(() => undefined)}
      >
        {withNextAction.length ? (
          <Panel bodyClassName="p-0">
            <ul className="divide-y divide-line">
              {withNextAction.map((lead) => {
                const age = Math.floor((Date.now() - new Date(lead.createdAt).getTime()) / 86400000);
                return (
                  <li key={lead.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <Link to={`/app/leads/${lead.id}`} className="block truncate text-[13px] font-medium text-fg hover:underline">
                        {lead.contactName}
                        {lead.businessName ? <span className="text-muted"> · {lead.businessName}</span> : null}
                      </Link>
                      <p className="truncate text-2xs text-muted">{lead.nextAction}</p>
                      <p className="mt-0.5 text-2xs text-faint">
                        {lead.phone ?? lead.email ?? 'No contact on file'} · logged {formatDateTime(lead.createdAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <Badge tone={age > 3 ? 'warning' : 'neutral'}>{age === 0 ? 'Today' : `${age}d old`}</Badge>
                      <Badge tone={lead.status === 'won' ? 'success' : 'info'}>{titleCase(lead.status)}</Badge>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Panel>
        ) : (
          <EmptyState
            title="No follow-ups scheduled"
            description="Add a next action on a lead and it shows up here until it is done."
            icon={<CalendarClock className="h-4 w-4" />}
          />
        )}
      </AsyncBoundary>
    </div>
  );
}
