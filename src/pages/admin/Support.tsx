import { useState } from 'react';
import { LifeBuoy } from 'lucide-react';
import { Panel } from '@/components/ui/Card';
import { AsyncBoundary, EmptyState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Badge';
import { AdminHeader, ListToolbar } from '@/components/admin/AdminHeader';
import { Drawer } from '@/components/ui/Modal';
import { Select, Textarea } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useToast } from '@/app/providers/ToastProvider';
import { ticketsService, clientsService } from '@/services';
import { formatDateTime, formatRelative, titleCase } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { Ticket } from '@/types';

const STATUSES = ['open', 'pending', 'resolved', 'closed'];

/** Support (spec §113): tickets with threaded replies, including internal notes. */
export default function Support() {
  usePageMeta({ title: 'Support', noIndex: true });
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [detail, setDetail] = useState<Ticket | null>(null);

  const state = useAsync(() => ticketsService.list(), []);
  const clients = useAsync(() => clientsService.list({ pageSize: 200 }), []);
  const clientName = (id: string | null) =>
    id ? clients.data?.items.find((client) => client.id === id)?.businessName ?? 'Unknown' : 'General';

  const items = (state.data?.items ?? []).filter((ticket) => {
    const matchesQuery = !query || ticket.subject.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (!status || ticket.status === status);
  });

  const reply = useMutation(
    (input: { id: string; body: string; internal: boolean; status?: string }) =>
      ticketsService.message(input.id, { body: input.body, internal: input.internal, status: input.status }),
    {
      onSuccess: async () => {
        toast.success('Reply sent');
        await state.refetch().catch(() => undefined);
      },
    },
  );

  return (
    <div>
      <AdminHeader
        title="Support"
        description="Conversations with clients, with internal notes kept private."
        crumbs={[{ label: 'Support' }]}
      />

      <ListToolbar
        search={query}
        onSearch={setQuery}
        searchPlaceholder="Search tickets…"
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
              {items.map((ticket) => (
                <li key={ticket.id}>
                  <button
                    type="button"
                    onClick={() => setDetail(ticket)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-elevated"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-fg">{ticket.subject}</span>
                      <span className="block truncate text-2xs text-muted">
                        {clientName(ticket.clientId)} · {ticket.messages.length} messages ·{' '}
                        {formatRelative(ticket.updatedAt)}
                      </span>
                    </span>
                    <Badge tone={ticket.priority === 'urgent' || ticket.priority === 'high' ? 'warning' : 'neutral'}>
                      {titleCase(ticket.priority)}
                    </Badge>
                    <Badge tone={ticket.status === 'resolved' || ticket.status === 'closed' ? 'success' : 'info'}>
                      {titleCase(ticket.status)}
                    </Badge>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        ) : (
          <EmptyState
            title="No support tickets"
            description="Client conversations appear here when they open one."
            icon={<LifeBuoy className="h-4 w-4" />}
          />
        )}
      </AsyncBoundary>

      <Drawer open={!!detail} onClose={() => setDetail(null)} title={detail?.subject ?? 'Ticket'} width="md">
        {detail ? (
          <div className="flex min-h-[440px] flex-col">
            <div className="flex-1 space-y-3">
              {detail.messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    'max-w-[90%] rounded-lg px-3.5 py-2.5 text-[13px] leading-relaxed',
                    message.authorRole === 'admin'
                      ? 'ml-auto bg-brand text-white'
                      : message.authorRole === 'ai'
                        ? 'border border-brand-violet/30 bg-brand-violet/[0.06] text-fg'
                        : 'border border-line bg-elevated text-fg',
                    message.internal && 'border-dashed border-warning/40 bg-warning/[0.05]',
                  )}
                >
                  <p className="mb-1 flex items-center gap-2 text-2xs uppercase tracking-wider opacity-70">
                    {message.authorRole === 'client' ? 'Client' : message.authorRole === 'ai' ? 'AI' : 'NorthForge'}
                    {message.internal ? <Badge tone="warning">Internal note</Badge> : null}
                  </p>
                  {message.body}
                  <p className="mt-1.5 text-2xs opacity-60">{formatDateTime(message.createdAt)}</p>
                </div>
              ))}
            </div>

            <form
              className="mt-4 space-y-3 border-t border-line pt-4"
              onSubmit={async (event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                const body = String(data.get('body') ?? '').trim();
                if (!body) return;
                await reply
                  .mutate({
                    id: detail.id,
                    body,
                    internal: data.get('internal') === 'on',
                    status: String(data.get('status') ?? '') || undefined,
                  })
                  .catch(() => undefined);
                event.currentTarget.reset();
              }}
            >
              <Textarea name="body" rows={3} placeholder="Write a reply…" aria-label="Reply" required />
              <div className="grid gap-3 sm:grid-cols-2">
                <Select
                  label="Set status"
                  name="status"
                  defaultValue={detail.status}
                  options={[{ value: '', label: 'Keep current' }, ...STATUSES.map((value) => ({ value, label: titleCase(value) }))]}
                />
                <label className="mt-6 flex items-center gap-2 text-[13px] text-fg">
                  <input type="checkbox" name="internal" className="h-3.5 w-3.5 accent-[rgb(var(--nf-blue))]" />
                  Internal note (not visible to the client)
                </label>
              </div>
              {reply.error ? <p className="text-xs text-danger">{reply.error}</p> : null}
              <Button type="submit" size="sm" loading={reply.pending}>
                Send reply
              </Button>
            </form>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
