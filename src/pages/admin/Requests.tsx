import { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { Panel } from '@/components/ui/Card';
import { AsyncBoundary, EmptyState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Badge';
import { AdminHeader, ListToolbar } from '@/components/admin/AdminHeader';
import { Drawer } from '@/components/ui/Modal';
import { Input, Select } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useToast } from '@/app/providers/ToastProvider';
import { requestsService, clientsService } from '@/services';
import { formatDateTime, formatRelative, titleCase } from '@/lib/format';
import type { ClientRequest } from '@/types';

const STATUSES = ['open', 'in_progress', 'blocked', 'resolved', 'closed'];
const TYPES = ['website_change', 'content_change', 'technical_issue', 'automation', 'general'];

/** Client requests (spec §113): the agency-side queue with replies. */
export default function Requests() {
  usePageMeta({ title: 'Client requests', noIndex: true });
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [detail, setDetail] = useState<ClientRequest | null>(null);

  const state = useAsync(() => requestsService.list(), []);
  const clients = useAsync(() => clientsService.list({ pageSize: 200 }), []);
  const clientName = (id: string) => clients.data?.items.find((client) => client.id === id)?.businessName ?? 'Unassigned';

  const items = (state.data?.items ?? []).filter((request) => {
    const matchesQuery =
      !query ||
      request.title.toLowerCase().includes(query.toLowerCase()) ||
      request.description.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (!status || request.status === status);
  });

  const open = items.filter((request) => request.status === 'open' || request.status === 'in_progress');

  const update = useMutation(
    (input: { id: string; status?: string; comment?: string }) => requestsService.update(input.id, input),
    {
      onSuccess: async () => {
        toast.success('Request updated');
        await state.refetch().catch(() => undefined);
      },
    },
  );

  return (
    <div>
      <AdminHeader
        title="Client requests"
        description="Change requests, issues and automation asks from every client."
        crumbs={[{ label: 'Requests' }]}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Kpi label="Total" value={items.length} />
        <Kpi label="Open" value={open.length} tone="warning" />
        <Kpi label="Blocked" value={items.filter((request) => request.status === 'blocked').length} tone="danger" />
      </div>

      <ListToolbar
        search={query}
        onSearch={setQuery}
        searchPlaceholder="Search requests…"
        filters={[
          {
            label: 'Status',
            value: status,
            onChange: setStatus,
            options: [{ value: '', label: 'All statuses' }, ...STATUSES.map((value) => ({ value, label: titleCase(value) }))],
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
          <Panel bodyClassName="p-0">
            <ul className="divide-y divide-line">
              {items.map((request) => (
                <li key={request.id}>
                  <button
                    type="button"
                    onClick={() => setDetail(request)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-elevated"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-fg">{request.title}</span>
                      <span className="block truncate text-2xs text-muted">
                        {clientName(request.clientId)} · {titleCase(request.type)} · {formatRelative(request.updatedAt)}
                      </span>
                    </span>
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
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        ) : (
          <EmptyState
            title="No requests"
            description="Client requests land here the moment they are raised."
            icon={<MessageSquare className="h-4 w-4" />}
          />
        )}
      </AsyncBoundary>

      <Drawer open={!!detail} onClose={() => setDetail(null)} title="Request" width="md">
        {detail ? (
          <div className="space-y-5">
            <div>
              <div className="mb-2 flex flex-wrap gap-1.5">
                <Badge tone="info">{titleCase(detail.status)}</Badge>
                <Badge tone="neutral">{titleCase(detail.priority)}</Badge>
                <Badge tone="neutral">{TYPES.includes(detail.type) ? titleCase(detail.type) : detail.type}</Badge>
              </div>
              <p className="text-[17px] font-semibold text-fg">{detail.title}</p>
              <p className="mt-1 text-[13px] text-muted">{clientName(detail.clientId)}</p>
            </div>

            <p className="rounded border border-line bg-sunken/40 p-3 text-[13px] leading-relaxed text-fg">
              {detail.description}
            </p>

            <div>
              <p className="nf-eyebrow mb-2">Details</p>
              <Row label="Raised" value={formatDateTime(detail.createdAt)} />
              <Row label="Updated" value={formatDateTime(detail.updatedAt)} />
              {detail.attachments?.length ? (
                <Row label="Attachments" value={String(detail.attachments.length)} />
              ) : null}
            </div>

            <form
              className="space-y-3 border-t border-line pt-4"
              onSubmit={async (event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                await update
                  .mutate({
                    id: detail.id,
                    status: String(data.get('status') ?? '') || undefined,
                    comment: String(data.get('comment') ?? '') || undefined,
                  })
                  .catch(() => undefined);
              }}
            >
              <Select
                label="Set status"
                name="status"
                defaultValue={detail.status}
                options={STATUSES.map((value) => ({ value, label: titleCase(value) }))}
              />
              <Input
                label="Reply to the client"
                name="comment"
                placeholder="What you have done, or what you need from them."
              />
              {update.error ? <p className="text-xs text-danger">{update.error}</p> : null}
              <Button type="submit" size="sm" loading={update.pending}>
                Update request
              </Button>
            </form>

            {detail.activity?.length ? (
              <div>
                <p className="nf-eyebrow mb-3">History</p>
                <ol className="space-y-3 border-l border-line pl-4">
                  {detail.activity.map((entry) => (
                    <li key={entry.id} className="relative">
                      <span className="absolute -left-[21px] top-1.5 h-1.5 w-1.5 rounded-full bg-brand" aria-hidden />
                      <p className="text-[13px] text-fg">
                        {entry.label}
                        {entry.detail ? ` — ${entry.detail}` : ''}
                      </p>
                      <p className="mt-0.5 text-2xs text-faint">
                        {entry.actor} · {formatDateTime(entry.createdAt)}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number; tone?: 'warning' | 'danger' }) {
  const toneClass = tone === 'warning' ? 'text-warning' : tone === 'danger' ? 'text-danger' : 'text-fg';
  return (
    <Panel>
      <p className="text-2xs uppercase tracking-wider text-faint">{label}</p>
      <p className={`nf-num mt-1 text-[22px] font-semibold ${toneClass}`}>{value}</p>
    </Panel>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2 last:border-0">
      <span className="text-[13px] text-muted">{label}</span>
      <span className="text-right text-[13px] font-medium text-fg">{value}</span>
    </div>
  );
}
