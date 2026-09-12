import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Panel } from '@/components/ui/Card';
import { AsyncBoundary, EmptyState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Badge';
import { PortalHeader, MetricRow } from '@/components/portal/PortalHeader';
import { Drawer } from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Tabs';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useToast } from '@/app/providers/ToastProvider';
import { requestsService } from '@/services';
import { formatDateTime, titleCase, formatRelative } from '@/lib/format';
import type { ClientRequest } from '@/types';

const TYPES = [
  { value: 'website_change', label: 'Website change' },
  { value: 'content_change', label: 'Content change' },
  { value: 'technical_issue', label: 'Technical issue' },
  { value: 'automation', label: 'New automation' },
  { value: 'general', label: 'Something else' },
];

/**
 * Client requests (spec §112).
 * A request is a tracked piece of work with a status and a history — not an
 * email that disappears into an inbox.
 */
export default function Requests() {
  usePageMeta({ title: 'Requests', noIndex: true });
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<ClientRequest | null>(null);
  const [filter, setFilter] = useState<'open' | 'all'>('open');

  const state = useAsync(() => requestsService.list(), []);
  const items = state.data?.items ?? [];
  const filtered = filter === 'open' ? items.filter((item) => item.status === 'open' || item.status === 'in_progress' || item.status === 'blocked') : items;

  const create = useMutation(
    (input: { title: string; description: string; type: string; priority: string }) =>
      requestsService.create({ ...input, type: input.type as never, priority: input.priority as never }),
    {
      onSuccess: async () => {
        toast.success('Request submitted', 'You can follow its progress here.');
        setCreating(false);
        await state.refetch().catch(() => undefined);
      },
    },
  );

  return (
    <div>
      <PortalHeader
        title="Requests"
        description="Ask for changes, report an issue, or request a new automation — tracked end to end."
        action={
          <Button size="sm" iconLeft={<Plus className="h-3.5 w-3.5" />} onClick={() => setCreating(true)}>
            New request
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented
          value={filter}
          onChange={(value) => setFilter(value as typeof filter)}
          options={[
            { value: 'open', label: 'Open' },
            { value: 'all', label: 'All' },
          ]}
          size="sm"
          ariaLabel="Request filter"
        />
        <span className="text-[13px] text-muted">
          {filtered.length} {filter === 'open' ? 'in progress' : 'total'}
        </span>
      </div>

      <AsyncBoundary
        loading={state.loading}
        error={state.error}
        data={state.data}
        onRetry={() => state.refetch().catch(() => undefined)}
      >
        {filtered.length ? (
          <div className="grid gap-3">
            {filtered.map((request) => (
              <button
                key={request.id}
                type="button"
                onClick={() => setDetail(request)}
                className="group rounded-lg border border-line bg-surface p-4 text-left transition-colors hover:border-brand/40"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium text-fg">{request.title}</p>
                    <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted">{request.description}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {request.isDemo ? <Badge tone="neutral">Demo</Badge> : null}
                    <Badge tone={request.priority === 'urgent' || request.priority === 'high' ? 'warning' : 'neutral'}>
                      {titleCase(request.priority)}
                    </Badge>
                    <Badge
                      tone={
                        request.status === 'resolved' || request.status === 'closed'
                          ? 'success'
                          : request.status === 'blocked'
                            ? 'danger'
                            : request.status === 'in_progress'
                              ? 'info'
                              : 'neutral'
                      }
                    >
                      {titleCase(request.status)}
                    </Badge>
                  </div>
                </div>
                <p className="mt-3 text-2xs uppercase tracking-wider text-faint">
                  {titleCase(request.type)} · updated {formatRelative(request.updatedAt)}
                </p>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState
            title={filter === 'open' ? 'Nothing in progress' : 'No requests yet'}
            description="Content changes, design tweaks, technical issues and new automations are all handled here."
            action={
              <Button variant="secondary" size="sm" onClick={() => setCreating(true)}>
                Raise a request
              </Button>
            }
          />
        )}
      </AsyncBoundary>

      <Drawer open={creating} onClose={() => setCreating(false)} title="New request" width="md">
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            await create
              .mutate({
                title: String(data.get('title') ?? ''),
                description: String(data.get('description') ?? ''),
                type: String(data.get('type') ?? 'general'),
                priority: String(data.get('priority') ?? 'medium'),
              })
              .catch(() => undefined);
          }}
          className="space-y-4"
        >
          <Select
            label="What kind of request?"
            name="type"
            defaultValue="website_change"
            options={TYPES}
          />
          <Input label="Title" name="title" required placeholder="e.g. Change the hero headline" />
          <Textarea
            label="Details"
            name="description"
            rows={5}
            required
            placeholder="What should change, and why? Links and screenshots help."
          />
          <Select
            label="How urgent?"
            name="priority"
            defaultValue="medium"
            options={[
              { value: 'low', label: 'Low — whenever' },
              { value: 'medium', label: 'Normal' },
              { value: 'high', label: 'High' },
              { value: 'urgent', label: 'Urgent — blocking us' },
            ]}
          />
          {create.error ? <p className="text-xs text-danger">{create.error}</p> : null}
          <Button type="submit" loading={create.pending}>
            Submit request
          </Button>
        </form>
      </Drawer>

      <Drawer open={!!detail} onClose={() => setDetail(null)} title="Request details" width="md">
        {detail ? (
          <div className="space-y-5">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={detail.status === 'resolved' ? 'success' : 'info'}>{titleCase(detail.status)}</Badge>
                <Badge tone="neutral">{titleCase(detail.priority)}</Badge>
                <Badge tone="neutral">{titleCase(detail.type)}</Badge>
              </div>
              <h3 className="mt-3 text-[17px] font-semibold tracking-tight text-fg">{detail.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-muted">{detail.description}</p>
            </div>

            <div>
              <p className="nf-eyebrow mb-1.5">Details</p>
              <MetricRow label="Raised" value={formatDateTime(detail.createdAt)} />
              <MetricRow label="Last update" value={formatDateTime(detail.updatedAt)} />
            </div>

            {detail.activity?.length ? (
              <div>
                <p className="nf-eyebrow mb-3">History</p>
                <ol className="space-y-3 border-l border-line pl-4">
                  {detail.activity.map((entry) => (
                    <li key={entry.id} className="relative">
                      <span
                        className="absolute -left-[21px] top-1.5 h-1.5 w-1.5 rounded-full bg-brand"
                        aria-hidden
                      />
                      <p className="text-[13px] text-fg">{entry.label}{entry.detail ? ` — ${entry.detail}` : ''}</p>
                      <p className="mt-0.5 text-2xs text-faint">
                        {entry.actor ?? 'System'} · {formatDateTime(entry.createdAt)}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </div>
        ) : null}
      </Drawer>

      <Panel className="mt-6" title="How requests work">
        <p className="text-[13px] leading-relaxed text-muted">
          Every request gets a status you can see: open, in progress, blocked, resolved or closed. If something is
          blocked, the reason is recorded here rather than going quiet.
        </p>
      </Panel>
    </div>
  );
}
