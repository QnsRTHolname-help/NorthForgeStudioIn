import { useState } from 'react';
import { Send } from 'lucide-react';
import { Panel, KpiCard } from '@/components/ui/Card';
import { AsyncBoundary, EmptyState } from '@/components/ui/States';
import { Badge, StatusIndicator } from '@/components/ui/Badge';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Modal } from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useToast } from '@/app/providers/ToastProvider';
import { whatsappService, clientsService } from '@/services';
import { formatDateTime, titleCase } from '@/lib/format';
import { cn } from '@/lib/cn';

/** WhatsApp operations (spec §113): connection, templates, send, history. */
export default function WhatsAppAdmin() {
  usePageMeta({ title: 'WhatsApp', noIndex: true });
  const toast = useToast();
  const [composing, setComposing] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);

  const status = useAsync(() => whatsappService.status(), []);
  const messages = useAsync(() => whatsappService.messages(), []);
  const templates = useAsync(() => whatsappService.templates(), []);
  const clients = useAsync(() => clientsService.list({ pageSize: 200 }), []);

  const data = status.data;
  const items = messages.data?.items ?? [];

  const send = useMutation(
    (input: { to: string; body: string; clientId?: string }) => whatsappService.send(input),
    {
      onSuccess: async () => {
        toast.success('Message sent');
        setComposing(false);
        await messages.refetch().catch(() => undefined);
      },
    },
  );

  return (
    <div>
      <AdminHeader
        title="WhatsApp"
        description="Business messaging: connection, approved templates and delivery history."
        crumbs={[{ label: 'WhatsApp' }]}
        action={
          <Button size="md" iconLeft={<Send className="h-3.5 w-3.5" />} onClick={() => setComposing(true)}>
            Send message
          </Button>
        }
      />

      <AsyncBoundary
        loading={status.loading}
        error={status.error}
        data={status.data}
        onRetry={() => status.refetch().catch(() => undefined)}
      >
        {data ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard label="Connection" value={data.connected ? 'Connected' : 'Not connected'} />
              <KpiCard label="Mode" value={data.mode === 'cloud_api' ? 'Cloud API' : 'Click to chat'} />
              <KpiCard label="Business number" value={data.businessNumber ?? '—'} />
              <KpiCard label="Automated sent" value={data.stats.automated} hint={`${data.stats.sent} outbound total`} />
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
              <Panel title="Message history" description="Inbound and outbound, newest first.">
                {items.length ? (
                  <ul className="divide-y divide-line">
                    {items.map((message) => (
                      <li key={message.id} className="flex items-start gap-3 py-3 first:pt-0">
                        <span
                          className={cn(
                            'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full',
                            message.direction === 'outbound' ? 'bg-brand' : 'bg-success',
                          )}
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-2 text-[13px] font-medium text-fg">
                            {message.direction === 'outbound' ? `To ${message.to}` : `From ${message.to}`}
                            {message.automated ? <Badge tone="info">Automated</Badge> : null}
                          </p>
                          <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{message.body}</p>
                          <p className="mt-1 text-2xs text-faint">{formatDateTime(message.createdAt)}</p>
                        </div>
                        <Badge
                          tone={
                            message.status === 'failed'
                              ? 'danger'
                              : message.status === 'read'
                                ? 'success'
                                : message.status === 'delivered'
                                  ? 'info'
                                  : 'neutral'
                          }
                        >
                          {titleCase(message.status)}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState compact title="No messages yet" description="Sent and received messages appear here." />
                )}
              </Panel>

              <div className="space-y-4">
                <Panel title="Connection">
                  <div className="space-y-2.5">
                    <StatusIndicator status={data.connected ? 'connected' : 'not connected'} tone={data.connected ? 'success' : 'neutral'} />
                    <Row label="Mode" value={data.mode === 'cloud_api' ? 'Cloud API' : 'Click to chat'} />
                    <Row label="Inbound" value={String(data.stats.inbound)} />
                    <Row label="Outbound" value={String(data.stats.sent)} />
                    <Row label="Templates" value={String(data.stats.templates)} />
                  </div>
                </Panel>

                <Panel
                  title="Templates"
                  action={
                    <button type="button" onClick={() => setTemplateOpen(true)} className="text-[13px] text-brand hover:underline">
                      New
                    </button>
                  }
                >
                  {(templates.data?.items ?? []).length ? (
                    <ul className="space-y-2.5">
                      {templates.data!.items.map((template) => (
                        <li key={template.id} className="rounded border border-line bg-sunken/30 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-xs text-fg">{template.name}</span>
                            <Badge tone={template.status === 'approved' ? 'success' : 'warning'}>{titleCase(template.status)}</Badge>
                          </div>
                          <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{template.body}</p>
                          <p className="mt-1.5 text-2xs text-faint">
                            {titleCase(template.category)} · {template.uses} uses
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyState compact title="No templates" description="Templates must be approved before use." />
                  )}
                </Panel>
              </div>
            </div>
          </div>
        ) : null}
      </AsyncBoundary>

      <Modal open={composing} onClose={() => setComposing(false)} title="Send a WhatsApp message">
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            await send
              .mutate({
                to: String(data.get('to') ?? ''),
                body: String(data.get('body') ?? ''),
                clientId: String(data.get('clientId') ?? '') || undefined,
              })
              .catch(() => undefined);
          }}
          className="space-y-4"
        >
          <Select
            label="Client (optional)"
            name="clientId"
            options={[{ value: '', label: 'Not linked to a client' }, ...(clients.data?.items ?? []).map((client) => ({ value: client.id, label: client.businessName }))]}
          />
          <Input label="To (number)" name="to" required placeholder="919845000000" hint="Country code first, digits only." />
          <Textarea label="Message" name="body" rows={4} required placeholder="Write the message…" />
          {send.error ? <p className="text-xs text-danger">{send.error}</p> : null}
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button variant="ghost" size="sm" onClick={() => setComposing(false)}>
              Cancel
            </Button>
            <Button size="sm" type="submit" loading={send.pending}>
              Send message
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={templateOpen} onClose={() => setTemplateOpen(false)} title="New template">
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            try {
              await whatsappService.createTemplate({
                name: String(data.get('name') ?? ''),
                body: String(data.get('body') ?? ''),
                category: String(data.get('category') ?? 'utility') as 'utility',
              });
              toast.success('Template submitted for approval');
              setTemplateOpen(false);
              await templates.refetch().catch(() => undefined);
            } catch {
              /* surfaced by toast */
            }
          }}
          className="space-y-4"
        >
          <Input label="Template name" name="name" required placeholder="enquiry_ack" hint="Lowercase, underscores only." />
          <Select
            label="Category"
            name="category"
            defaultValue="utility"
            options={[
              { value: 'utility', label: 'Utility' },
              { value: 'marketing', label: 'Marketing' },
              { value: 'authentication', label: 'Authentication' },
            ]}
          />
          <Textarea label="Body" name="body" rows={4} required placeholder="Hi {{1}}, thanks for contacting us…" />
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button variant="ghost" size="sm" onClick={() => setTemplateOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" type="submit">
              Submit template
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-[13px] text-muted">{label}</span>
      <span className="text-[13px] font-medium text-fg">{value}</span>
    </div>
  );
}
