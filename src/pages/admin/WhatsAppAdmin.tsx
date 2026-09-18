import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, MessageCircle, Send } from 'lucide-react';
import { Panel, KpiCard } from '@/components/ui/Card';
import { AsyncBoundary, EmptyState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Badge';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Modal } from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { ClientSelect } from '@/components/admin/ClientSelect';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useToast } from '@/app/providers/ToastProvider';
import { whatsappService, clientsService } from '@/services';
import { formatDateTime, formatRelative, formatTime, titleCase } from '@/lib/format';
import { groupThreads, normalizeWhatsAppNumber, prettyWhatsAppNumber, threadStatus, waLink } from '@/lib/whatsapp';
import { cn } from '@/lib/cn';
import type { Client, WhatsAppMessage, WhatsAppTemplate } from '@/types';

/**
 * WhatsApp inbox (spec §113).
 *
 * A real two-way messaging surface: threads grouped by the customer's
 * number, chat bubbles, replies from the same pane. Delivery goes through
 * the Cloud API Edge Function; when that is not connected yet, every send
 * offers an honest one-click wa.me handoff instead of a fake "sent" toast.
 */
export default function WhatsAppAdmin() {
  usePageMeta({ title: 'WhatsApp', noIndex: true });
  const toast = useToast();
  const [composing, setComposing] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [searchParams] = useSearchParams();

  const status = useAsync(() => whatsappService.status(), []);
  const messages = useAsync(() => whatsappService.messages(), []);
  const templates = useAsync(() => whatsappService.templates(), []);
  const clients = useAsync(() => clientsService.list({ pageSize: 1000 }), []);

  const data = status.data;
  const threads = useMemo(() => groupThreads(messages.data?.items ?? []), [messages.data]);

  /** Client lookup by stored link or by phone digits (best-effort labelling). */
  const clientFor = (digits: string, clientId: string | null): Client | null => {
    const linked = clientId ? (clients.data?.items.find((client) => client.id === clientId) ?? null) : null;
    if (linked) return linked;
    return clients.data?.items.find((client) => normalizeWhatsAppNumber(client.phone) === digits) ?? null;
  };

  // Deep link: /app/whatsapp?to=919845012345 (opened from a lead or client).
  useEffect(() => {
    const to = searchParams.get('to');
    if (!to) return;
    const digits = normalizeWhatsAppNumber(to);
    if (digits) setSelectedKey(digits);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedThread = selectedKey ? (threads.find((thread) => thread.key === selectedKey) ?? null) : null;
  const selectedClient = selectedKey ? clientFor(selectedKey, selectedThread?.clientId ?? null) : null;

  return (
    <div>
      <AdminHeader
        title="WhatsApp"
        description="Every conversation with a customer — reply here, or hand a message to the business WhatsApp in one click."
        crumbs={[{ label: 'WhatsApp' }]}
        action={
          <Button size="md" iconLeft={<Send className="h-3.5 w-3.5" />} onClick={() => setComposing(true)}>
            New message
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
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <KpiCard
                label="Connection"
                value={data.connected ? 'Cloud API' : 'Click to chat'}
                hint={data.connected ? 'Sending from the business number' : 'Cloud API not connected yet'}
              />
              <KpiCard label="Business number" value={data.businessNumber ?? '—'} />
              <KpiCard label="Inbound" value={data.stats.inbound} hint="Replies from customers" />
              <KpiCard label="Outbound" value={data.stats.sent} hint={`${data.stats.templates} templates`} />
            </div>

            {!data.connected ? <SetupNotice /> : null}

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
              {/* ── Inbox: thread list + chat ─────────────────── */}
              <div className="grid min-h-[520px] gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
                <Panel
                  title="Conversations"
                  bodyClassName="p-0"
                  className={cn('min-h-0', selectedKey && 'hidden lg:block')}
                >
                  {messages.loading ? (
                    <p className="px-4 py-6 text-[13px] text-muted">Loading conversations…</p>
                  ) : threads.length ? (
                    <ul className="max-h-[560px] divide-y divide-line overflow-y-auto">
                      {threads.map((thread) => {
                        const client = clientFor(thread.key, thread.clientId);
                        const outboundStatus = threadStatus(thread);
                        return (
                          <li key={thread.key}>
                            <button
                              type="button"
                              onClick={() => setSelectedKey(thread.key)}
                              aria-current={selectedKey === thread.key || undefined}
                              className={cn(
                                'flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-sunken/60',
                                selectedKey === thread.key && 'bg-brand/[0.07]',
                              )}
                            >
                              <span className="flex w-full items-center justify-between gap-2">
                                <span className="truncate text-[13px] font-medium text-fg">
                                  {client?.businessName ?? thread.partner}
                                </span>
                                <span className="shrink-0 text-2xs text-faint">{formatRelative(thread.lastAt)}</span>
                              </span>
                              <span className="block truncate text-xs text-muted">{thread.lastBody}</span>
                              <span className="flex flex-wrap items-center gap-2">
                                {client ? <Badge tone="neutral">{client.businessName}</Badge> : null}
                                {outboundStatus ? (
                                  <Badge
                                    tone={
                                      outboundStatus === 'failed'
                                        ? 'danger'
                                        : outboundStatus === 'queued'
                                          ? 'warning'
                                          : outboundStatus === 'read'
                                            ? 'success'
                                            : 'info'
                                    }
                                  >
                                    {titleCase(outboundStatus)}
                                  </Badge>
                                ) : null}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <EmptyState
                      compact
                      title="No conversations yet"
                      description="Send the first message, or open a lead and tap WhatsApp."
                      icon={<MessageCircle className="h-4 w-4" />}
                    />
                  )}
                </Panel>

                <ChatPane
                  number={selectedKey}
                  thread={selectedThread}
                  client={selectedClient}
                  loading={messages.loading}
                  templates={templates.data?.items ?? []}
                  onBack={() => setSelectedKey(null)}
                  onSent={() => {
                    void messages.refetch().catch(() => undefined);
                    void status.refetch().catch(() => undefined);
                  }}
                />
              </div>

              {/* ── Right rail: connection + templates ────────── */}
              <div className="space-y-4">
                <Panel title="Connection">
                  <div className="space-y-2.5">
                    <p className="text-[13px] leading-relaxed text-muted">
                      {data.connected
                        ? 'Messages you send here go out through the WhatsApp Cloud API from the business number, and customer replies arrive in this inbox.'
                        : 'The Cloud API is not connected on this project yet. Messages can still be sent — each one opens in the business WhatsApp with the text pre-typed.'}
                    </p>
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

      <ComposeModal
        open={composing}
        onClose={() => setComposing(false)}
        clients={clients.data?.items ?? []}
        templates={templates.data?.items ?? []}
        onDone={() => {
          setComposing(false);
          void messages.refetch().catch(() => undefined);
          void status.refetch().catch(() => undefined);
        }}
      />

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

/**
 * The conversation pane: bubbles, status, composer.
 *
 * Desktop: shown beside the thread list. Mobile: shown full-width in place
 * of the list, with a back button. When the number has no history yet it
 * still opens as a fresh conversation — sending the first message creates
 * the thread.
 */
function ChatPane({
  number,
  thread,
  client,
  loading,
  templates,
  onBack,
  onSent,
}: {
  number: string | null;
  thread: ReturnType<typeof groupThreads>[number] | null;
  client: Client | null;
  loading: boolean;
  templates: WhatsAppTemplate[];
  onBack: () => void;
  onSent: () => void;
}) {
  const toast = useToast();
  const [draft, setDraft] = useState('');
  const [sentNow, setSentNow] = useState(false);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const digits = thread?.key ?? number;
  const partnerLabel = client?.businessName ?? prettyWhatsAppNumber(digits);
  const partnerLink = waLink(digits, 'Hi — this is NorthForge.');

  useEffect(() => {
    setDraft('');
    setFailure(null);
    setFallbackUrl(null);
    setSentNow(false);
  }, [digits]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [thread?.messages.length, digits]);

  const send = useMutation(async (body: string) => {
    if (!digits) throw new Error('Pick a conversation first.');
    return whatsappService.send({ to: digits, body, clientId: client?.id ?? undefined });
  });

  const submit = async () => {
    const body = draft.trim();
    if (!body) return;
    setFailure(null);
    setFallbackUrl(null);
    try {
      const outcome = await send.mutate(body);
      setDraft('');
      setSentNow(outcome.sent);
      setFallbackUrl(outcome.sent ? null : outcome.fallbackUrl);
      if (outcome.sent) {
        toast.success('Message sent');
      } else {
        setFailure(outcome.reason);
      }
      onSent();
    } catch {
      /* surfaced inline below */
    }
  };

  if (!digits) {
    return (
      <Panel className="hidden min-h-0 items-center justify-center lg:flex">
        <div className="p-8 text-center">
          <MessageCircle className="mx-auto h-5 w-5 text-faint" aria-hidden />
          <p className="mt-3 text-[13px] text-muted">Select a conversation, or start a new one.</p>
        </div>
      </Panel>
    );
  }

  return (
    <Panel bodyClassName="p-0" className="flex min-h-0 flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <Button
          variant="ghost"
          size="sm"
          className="lg:hidden"
          iconLeft={<ArrowLeft className="h-3.5 w-3.5" />}
          onClick={onBack}
          aria-label="Back to conversations"
        >
          Back
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-fg">{partnerLabel}</p>
          <p className="truncate text-2xs text-faint">{prettyWhatsAppNumber(digits)}</p>
        </div>
        {partnerLink ? (
          <a
            href={partnerLink}
            target="_blank"
            rel="noreferrer noopener"
            className="nf-focus inline-flex h-8 items-center gap-1.5 rounded border border-line px-2.5 text-2xs font-medium text-fg transition-colors hover:bg-elevated"
          >
            <ExternalLink className="h-3 w-3" aria-hidden />
            Open in WhatsApp
          </a>
        ) : null}
      </div>

      {/* Messages */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {loading ? (
          <p className="text-[13px] text-muted">Loading messages…</p>
        ) : thread?.messages.length ? (
          thread.messages.map((message) => <Bubble key={message.id} message={message} />)
        ) : (
          <p className="text-[13px] text-muted">
            No messages with {prettyWhatsAppNumber(digits)} yet — write the first one below.
          </p>
        )}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      <div className="space-y-2 border-t border-line px-4 py-3">
        {failure ? (
          <div className="space-y-1.5 rounded border border-warning/40 bg-warning/[0.06] p-2.5">
            <p className="text-xs leading-relaxed text-fg">{failure}</p>
            {fallbackUrl ? (
              <a
                href={fallbackUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-brand hover:underline"
              >
                <ExternalLink className="h-3 w-3" aria-hidden />
                Open this message in the business WhatsApp
              </a>
            ) : null}
          </div>
        ) : sentNow ? (
          <p className="text-2xs text-success">Delivered to WhatsApp.</p>
        ) : null}

        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={2}
          placeholder="Write a message…"
          aria-label="Message"
          containerClassName="gap-1"
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              void submit();
            }
          }}
        />

        <div className="flex flex-wrap items-center gap-2">
          {templates.length ? (
            <Select
              aria-label="Insert a template"
              value=""
              onChange={(event) => {
                const template = templates.find((candidate) => candidate.id === event.target.value);
                if (template) setDraft(template.body);
              }}
              className="h-8 w-auto max-w-[220px] text-xs"
              options={[
                { value: '', label: 'Insert template…' },
                ...templates.map((template) => ({ value: template.id, label: template.name })),
              ]}
              containerClassName="gap-0"
            />
          ) : null}
          <span className="flex-1" />
          <Button size="sm" iconLeft={<Send className="h-3.5 w-3.5" />} loading={send.pending} disabled={!draft.trim()} onClick={() => void submit()}>
            Send
          </Button>
        </div>
        <p className="text-2xs text-faint">Ctrl/⌘ + Enter to send · replies arrive in this inbox when the webhook is connected.</p>
      </div>
    </Panel>
  );
}

/** One chat bubble with its delivery status. */
function Bubble({ message }: { message: WhatsAppMessage }) {
  const outbound = message.direction === 'outbound';
  return (
    <div className={cn('flex flex-col', outbound ? 'items-end' : 'items-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-lg px-3.5 py-2.5 text-[13px] leading-relaxed sm:max-w-[75%]',
          outbound ? 'bg-brand text-white' : 'border border-line bg-elevated text-fg',
        )}
      >
        {message.body}
      </div>
      <p className={cn('mt-1 flex items-center gap-2 text-2xs text-faint', outbound && 'flex-row-reverse')}>
        <span>{formatTime(message.createdAt)}</span>
        {outbound ? (
          <span
            className={cn(
              'font-medium',
              message.status === 'failed' ? 'text-danger' : message.status === 'read' ? 'text-success' : 'text-faint',
            )}
          >
            {message.status === 'queued' ? 'Queued' : titleCase(message.status)}
          </span>
        ) : (
          <span>{formatDateTime(message.createdAt)}</span>
        )}
        {message.automated ? <Badge tone="info">Automated</Badge> : null}
      </p>
    </div>
  );
}

/** Shown until the Cloud API credentials are set: exact, short, honest. */
function SetupNotice() {
  return (
    <Panel title="Connect the WhatsApp Cloud API" description="Five minutes, one time — then this inbox sends and receives for real.">
      <ol className="list-decimal space-y-1.5 pl-5 text-[13px] leading-relaxed text-muted">
        <li>Create a Meta app (developers.facebook.com), add the WhatsApp product and note the <strong className="text-fg">phone number ID</strong>.</li>
        <li>Generate a permanent <strong className="text-fg">access token</strong> for that number.</li>
        <li>
          <code className="rounded bg-sunken px-1 py-0.5 text-xs">supabase secrets set WHATSAPP_ACCESS_TOKEN=… WHATSAPP_PHONE_NUMBER_ID=… WHATSAPP_VERIFY_TOKEN=any-string</code>
        </li>
        <li>
          <code className="rounded bg-sunken px-1 py-0.5 text-xs">supabase functions deploy whatsapp-send</code> and{' '}
          <code className="rounded bg-sunken px-1 py-0.5 text-xs">supabase functions deploy whatsapp-webhook --no-verify-jwt</code>
        </li>
        <li>Point Meta's webhook at the deployed <code className="rounded bg-sunken px-1 py-0.5 text-xs">whatsapp-webhook</code> URL and subscribe to <em>messages</em>.</li>
      </ol>
      <p className="mt-3 text-xs text-faint">Full walkthrough: docs/WHATSAPP_SETUP.md in the repository. Until then every send opens the business WhatsApp with the text pre-typed.</p>
    </Panel>
  );
}

/** Compose to a brand-new number (optionally linked to a client). */
function ComposeModal({
  open,
  onClose,
  clients,
  templates,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  clients: Client[];
  templates: WhatsAppTemplate[];
  onDone: () => void;
}) {
  const toast = useToast();
  const [clientId, setClientId] = useState('');
  const [to, setTo] = useState('');
  const [body, setBody] = useState('');
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const send = useMutation(
    () => whatsappService.send({ to, body, clientId: clientId || undefined }),
    {
      onSuccess: (outcome) => {
        if (outcome.sent) {
          toast.success('Message sent');
          onDone();
        } else {
          setFailure(outcome.reason);
          setFallbackUrl(outcome.fallbackUrl);
        }
      },
    },
  );

  useEffect(() => {
    if (!open) {
      setClientId('');
      setTo('');
      setBody('');
      setFallbackUrl(null);
      setFailure(null);
    }
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title="New WhatsApp message">
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setFailure(null);
          setFallbackUrl(null);
          await send.mutate().catch(() => undefined);
        }}
        className="space-y-4"
      >
        <ClientSelect
          label="Client (optional)"
          value={clientId}
          onChange={(id) => {
            setClientId(id);
            const phone = clients.find((client) => client.id === id)?.phone ?? '';
            if (phone) setTo(normalizeWhatsAppNumber(phone) ?? to);
          }}
        />
        <Input
          label="To (WhatsApp number)"
          value={to}
          onChange={(event) => setTo(event.target.value)}
          required
          placeholder="919845012345"
          hint="Country code first — +91, spaces and brackets are fine."
        />
        {templates.length ? (
          <Select
            label="Start from a template (optional)"
            value=""
            onChange={(event) => {
              const template = templates.find((candidate) => candidate.id === event.target.value);
              if (template) setBody(template.body);
            }}
            options={[
              { value: '', label: 'Choose a template…' },
              ...templates.map((template) => ({ value: template.id, label: `${template.name} (${titleCase(template.status)})` })),
            ]}
          />
        ) : null}
        <Textarea label="Message" value={body} onChange={(event) => setBody(event.target.value)} rows={4} required placeholder="Write the message…" />

        {failure ? (
          <div className="space-y-1.5 rounded border border-warning/40 bg-warning/[0.06] p-2.5">
            <p className="text-xs leading-relaxed text-fg">{failure}</p>
            {fallbackUrl ? (
              <a
                href={fallbackUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-brand hover:underline"
              >
                <ExternalLink className="h-3 w-3" aria-hidden />
                Open this message in the business WhatsApp
              </a>
            ) : null}
            <p className="text-2xs text-faint">The message is saved as queued either way.</p>
          </div>
        ) : null}
        {send.error && !failure ? <p className="text-xs text-danger">{send.error}</p> : null}

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" type="submit" loading={send.pending} disabled={!to.trim() || !body.trim()}>
            Send message
          </Button>
        </div>
      </form>
    </Modal>
  );
}










