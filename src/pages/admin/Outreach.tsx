import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Send } from 'lucide-react';
import { Panel } from '@/components/ui/Card';
import { AsyncBoundary, EmptyState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Badge';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Input, Select, Textarea } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useToast } from '@/app/providers/ToastProvider';
import { leadsService, whatsappService } from '@/services';
import { formatDateTime, titleCase } from '@/lib/format';
import { BILLING_INTERVAL_DAYS, PLANS } from '@shared/catalog';

/**
 * Outreach (spec §113).
 *
 * Outbound leads are the same records as inbound ones, tagged by source,
 * so nothing is a second-class citizen in the pipeline.
 */
export default function Outreach() {
  usePageMeta({ title: 'Outreach', noIndex: true });
  const toast = useToast();
  const state = useAsync(() => leadsService.list({ source: 'outreach', pageSize: 100 }), []);
  const items = state.data?.items ?? [];

  const [form, setForm] = useState({ contactName: '', businessName: '', phone: '', email: '', note: '' });
  const [channel, setChannel] = useState<'whatsapp' | 'note'>('whatsapp');

  const create = useMutation(
    async () => {
      const lead = await leadsService.create({
        contactName: form.contactName.trim(),
        businessName: form.businessName.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        source: 'outreach',
        status: 'contacted',
        message: form.note.trim() || null,
        nextAction: 'Follow up in 3 days',
      });
      if (channel === 'whatsapp' && form.phone.trim()) {
        await whatsappService
          .send({
            to: form.phone.trim(),
            body: `Hi ${form.contactName.trim()} — following up from NorthForge. Happy to answer any questions about getting your business online.`,
          })
          .catch(() => undefined);
      }
      return lead;
    },
    {
      onSuccess: async () => {
        toast.success('Outreach logged');
        setForm({ contactName: '', businessName: '', phone: '', email: '', note: '' });
        await state.refetch().catch(() => undefined);
      },
    },
  );

  const growth = PLANS.find((plan) => plan.slug === 'convert');

  return (
    <div>
      <AdminHeader
        title="Outreach"
        description="Log outbound conversations so they are tracked like any other lead."
        crumbs={[{ label: 'Outreach' }]}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Panel title="Log an outreach">
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              await create.mutate().catch(() => undefined);
            }}
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Contact name" required value={form.contactName} onChange={(event) => setForm({ ...form, contactName: event.target.value })} />
              <Input label="Business" value={form.businessName} onChange={(event) => setForm({ ...form, businessName: event.target.value })} />
              <Input label="WhatsApp / phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
              <Input label="Email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            </div>
            <Select
              label="Channel"
              value={channel}
              onChange={(event) => setChannel(event.target.value as 'whatsapp' | 'note')}
              options={[
                { value: 'whatsapp', label: 'WhatsApp (sends a message)' },
                { value: 'note', label: 'Log only' },
              ]}
            />
            <Textarea
              label="Note"
              rows={3}
              value={form.note}
              onChange={(event) => setForm({ ...form, note: event.target.value })}
              hint="What was discussed and what happens next."
            />
            {create.error ? <p className="text-xs text-danger">{create.error}</p> : null}
            <Button type="submit" loading={create.pending} iconLeft={<Send className="h-3.5 w-3.5" />} disabled={!form.contactName.trim()}>
              Log outreach
            </Button>
          </form>
        </Panel>

        <Panel title="Outreach pipeline">
          <AsyncBoundary
            loading={state.loading}
            error={state.error}
            data={state.data}
            onRetry={() => state.refetch().catch(() => undefined)}
          >
            {items.length ? (
              <ul className="space-y-2">
                {items.map((lead) => (
                  <li key={lead.id} className="flex items-center justify-between gap-3 rounded border border-line bg-sunken/30 px-3 py-2.5">
                    <div className="min-w-0">
                      <Link to={`/app/leads/${lead.id}`} className="block truncate text-[13px] font-medium text-fg hover:underline">
                        {lead.contactName}
                      </Link>
                      <p className="truncate text-2xs text-faint">
                        {lead.businessName ?? '—'} · {formatDateTime(lead.createdAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge tone={lead.status === 'won' ? 'success' : 'neutral'}>{titleCase(lead.status)}</Badge>
                      <span className="nf-num text-2xs text-faint">{lead.score}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact title="No outreach yet" description="Logged conversations appear here with their status." />
            )}
          </AsyncBoundary>
        </Panel>
      </div>

      <Panel className="mt-4" title="Reference">
        <p className="text-[13px] leading-relaxed text-muted">
          Plans billed every {BILLING_INTERVAL_DAYS} days
          {growth ? `, starting at ₹${(growth.amount! / 100).toLocaleString('en-IN')} for Growth` : ''}. Hosting, SSL and a
          custom domain are included on every plan.
        </p>
      </Panel>
    </div>
  );
}
