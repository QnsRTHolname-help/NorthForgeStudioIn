import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Panel } from '@/components/ui/Card';
import { AsyncBoundary, EmptyState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Badge';
import { PortalHeader } from '@/components/portal/PortalHeader';
import { Drawer } from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useToast } from '@/app/providers/ToastProvider';
import { ticketsService } from '@/services';
import { formatDateTime, titleCase } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { Ticket } from '@/types';

/** Support (spec §112): threaded conversations with the team. */
export default function Support() {
  usePageMeta({ title: 'Support', noIndex: true });
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<Ticket | null>(null);

  const state = useAsync(() => ticketsService.list(), []);
  const items = state.data?.items ?? [];

  const create = useMutation(
    (input: { subject: string; message: string; priority: string; category: string }) => ticketsService.create(input as never),
    {
      onSuccess: async (result) => {
        toast.success('Support request opened');
        setCreating(false);
        await state.refetch().catch(() => undefined);
        setDetail(result.ticket);
      },
    },
  );

  return (
    <div>
      <PortalHeader
        title="Support"
        description="Something not working, or a question you would rather ask a person?"
        action={
          <Button size="sm" iconLeft={<Plus className="h-3.5 w-3.5" />} onClick={() => setCreating(true)}>
            New conversation
          </Button>
        }
      />

      <AsyncBoundary
        loading={state.loading}
        error={state.error}
        data={state.data}
        onRetry={() => state.refetch().catch(() => undefined)}
      >
        {items.length ? (
          <div className="grid gap-3">
            {items.map((ticket) => (
              <button
                key={ticket.id}
                type="button"
                onClick={() => setDetail(ticket)}
                className="group rounded-lg border border-line bg-surface p-4 text-left transition-colors hover:border-brand/40"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="text-[14px] font-medium text-fg">{ticket.subject}</p>
                  <div className="flex items-center gap-2">
                    <Badge tone={ticket.priority === 'urgent' || ticket.priority === 'high' ? 'warning' : 'neutral'}>
                      {titleCase(ticket.priority)}
                    </Badge>
                    <Badge tone={ticket.status === 'resolved' || ticket.status === 'closed' ? 'success' : 'info'}>
                      {titleCase(ticket.status)}
                    </Badge>
                  </div>
                </div>
                <p className="mt-2 text-xs text-faint">
                  {ticket.messages.length} message{ticket.messages.length === 1 ? '' : 's'} · updated{' '}
                  {formatDateTime(ticket.updatedAt)}
                </p>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No support conversations"
            description="Open a conversation whenever something needs a human. We answer in the order received, urgent items first."
            action={
              <Button variant="secondary" size="sm" onClick={() => setCreating(true)}>
                Start one
              </Button>
            }
          />
        )}
      </AsyncBoundary>

      <Drawer open={creating} onClose={() => setCreating(false)} title="New support conversation" width="md">
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            await create
              .mutate({
                subject: String(data.get('subject') ?? ''),
                message: String(data.get('message') ?? ''),
                priority: String(data.get('priority') ?? 'medium'),
                category: String(data.get('category') ?? 'general'),
              })
              .catch(() => undefined);
          }}
          className="space-y-4"
        >
          <Input label="Subject" name="subject" required placeholder="What is happening?" />
          <Select
            label="Category"
            name="category"
            defaultValue="general"
            options={[
              { value: 'general', label: 'General question' },
              { value: 'website', label: 'Website issue' },
              { value: 'billing', label: 'Billing' },
              { value: 'automation', label: 'Automation / AI' },
            ]}
          />
          <Select
            label="Priority"
            name="priority"
            defaultValue="medium"
            options={[
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Normal' },
              { value: 'high', label: 'High' },
              { value: 'urgent', label: 'Urgent' },
            ]}
          />
          <Textarea label="Message" name="message" rows={5} required placeholder="Give us as much detail as you can." />
          {create.error ? <p className="text-xs text-danger">{create.error}</p> : null}
          <Button type="submit" loading={create.pending}>
            Open conversation
          </Button>
        </form>
      </Drawer>

      <Drawer open={!!detail} onClose={() => setDetail(null)} title={detail?.subject ?? 'Support'} width="md">
        {detail ? <TicketThread ticket={detail} onSent={() => state.refetch().catch(() => undefined)} /> : null}
      </Drawer>

      <Panel className="mt-6" title="Faster options">
        <p className="text-[13px] leading-relaxed text-muted">
          For a change to your website, a <span className="font-medium text-fg">request</span> is usually quicker than a
          support conversation — it goes straight into the delivery queue.
        </p>
      </Panel>
    </div>
  );
}

function TicketThread({ ticket, onSent }: { ticket: Ticket; onSent: () => void }) {
  const [body, setBody] = useState('');
  const mutation = useMutation(() => ticketsService.message(ticket.id, { body: body.trim() }), {
    onSuccess: () => {
      setBody('');
      onSent();
    },
  });

  return (
    <div className="flex min-h-[420px] flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto">
        {ticket.messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              'max-w-[88%] rounded-lg px-3.5 py-2.5 text-[13px] leading-relaxed',
              message.authorRole === 'client'
                ? 'ml-auto bg-brand text-white'
                : message.authorRole === 'ai'
                  ? 'border border-brand-violet/30 bg-brand-violet/[0.06] text-fg'
                  : 'border border-line bg-elevated text-fg',
            )}
          >
            <p className="mb-1 text-2xs uppercase tracking-wider opacity-70">
              {message.authorRole === 'client' ? 'You' : message.authorRole === 'ai' ? 'NorthForge AI' : 'NorthForge'}
            </p>
            {message.body}
            <p className="mt-1.5 text-2xs opacity-60">{formatDateTime(message.createdAt)}</p>
          </div>
        ))}
      </div>

      {ticket.status !== 'closed' ? (
        <form
          className="mt-4 border-t border-line pt-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!body.trim()) return;
            await mutation.mutate().catch(() => undefined);
          }}
        >
          <Textarea
            rows={3}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Write a reply…"
            aria-label="Reply"
          />
          <div className="mt-2 flex items-center justify-between">
            {mutation.error ? <p className="text-xs text-danger">{mutation.error}</p> : <span />}
            <Button size="sm" type="submit" loading={mutation.pending} disabled={!body.trim()}>
              Send reply
            </Button>
          </div>
        </form>
      ) : (
        <p className="mt-4 border-t border-line pt-4 text-[13px] text-muted">
          This conversation is closed. Open a new one if you need more help.
        </p>
      )}
    </div>
  );
}
