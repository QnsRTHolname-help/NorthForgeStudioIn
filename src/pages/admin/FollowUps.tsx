import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, CheckCircle2, Plus, XCircle } from 'lucide-react';
import { Panel } from '@/components/ui/Card';
import { AsyncBoundary, EmptyState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Badge';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Segmented } from '@/components/ui/Tabs';
import { Drawer } from '@/components/ui/Modal';
import { Input, Textarea } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useToast } from '@/app/providers/ToastProvider';
import { leadsService } from '@/services';
import { formatDateTime, titleCase } from '@/lib/format';
import type { Lead } from '@/types';

/**
 * Follow-ups (spec §113).
 * Everything promised to a lead, in due-date order, with overdue first.
 */
export default function FollowUps() {
  usePageMeta({ title: 'Follow-ups', noIndex: true });
  const toast = useToast();
  const [view, setView] = useState<'open' | 'all'>('open');
  const [logging, setLogging] = useState<Lead | null>(null);

  const state = useAsync(async () => {
    const result = await leadsService.list({ pageSize: 200 });
    return result;
  }, []);

  const leads = state.data?.items ?? [];

  const setStatus = useMutation((input: { id: string; status: 'won' | 'lost' }) => leadsService.update(input.id, { status: input.status }), {
    onSuccess: async () => {
      toast.success('Lead updated');
      await state.refetch().catch(() => undefined);
    },
  });

  const logAction = useMutation(
    (input: { lead: Lead; nextAction: string; title: string; dueAt: string }) =>
      leadsService.addFollowUp(input.lead.id, { title: input.title, dueAt: input.dueAt, channel: 'call' }),
    {
      onSuccess: async (_result, input) => {
        toast.success('Follow-up logged');
        await leadsService
          .update(input.lead.id, { nextAction: input.nextAction })
          .catch(() => undefined);
        setLogging(null);
        await state.refetch().catch(() => undefined);
      },
    },
  );

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
                    {!['won', 'lost'].includes(lead.status) ? (
                      <div className="flex shrink-0 flex-col gap-1.5">
                        <Button size="sm" variant="secondary" iconLeft={<Plus className="h-3 w-3" />} onClick={() => setLogging(lead)}>
                          Log next action
                        </Button>
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Mark ${lead.contactName} as won`}
                            onClick={() => void setStatus.mutate({ id: lead.id, status: 'won' }).catch(() => undefined)}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Mark ${lead.contactName} as lost`}
                            onClick={() => void setStatus.mutate({ id: lead.id, status: 'lost' }).catch(() => undefined)}
                          >
                            <XCircle className="h-3.5 w-3.5 text-danger" aria-hidden />
                          </Button>
                        </div>
                      </div>
                    ) : null}
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

      <Drawer open={!!logging} onClose={() => setLogging(null)} title="Log next action" width="md">
        {logging ? (
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              await logAction
                .mutate({
                  lead: logging,
                  nextAction: String(data.get('nextAction') ?? ''),
                  title: String(data.get('title') ?? ''),
                  dueAt: new Date(String(data.get('dueAt') ?? '')).toISOString(),
                })
                .catch(() => undefined);
            }}
            className="space-y-4"
          >
            <p className="text-[13px] text-muted">
              For <span className="font-medium text-fg">{logging.contactName}</span>
              {logging.businessName ? ` · ${logging.businessName}` : ''}
            </p>
            <Textarea label="Next action (shown here)" name="nextAction" rows={2} required placeholder="Send proposal, follow up on pricing…" />
            <Input label="Follow-up title" name="title" required placeholder="Call to confirm" />
            <Input label="Due at" name="dueAt" type="datetime-local" required />
            {logAction.error ? <p className="text-xs text-danger">{logAction.error}</p> : null}
            <div className="flex justify-end gap-2 border-t border-line pt-4">
              <Button variant="ghost" size="sm" onClick={() => setLogging(null)}>
                Cancel
              </Button>
              <Button size="sm" type="submit" loading={logAction.pending}>
                Log action
              </Button>
            </div>
          </form>
        ) : null}
      </Drawer>
    </div>
  );
}
