import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FilePlus2 } from 'lucide-react';
import { Panel, KpiCard } from '@/components/ui/Card';
import { AsyncBoundary, EmptyState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Badge';
import { AdminHeader, ListToolbar } from '@/components/admin/AdminHeader';
import { Drawer, Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { ClientSelect } from '@/components/admin/ClientSelect';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useToast } from '@/app/providers/ToastProvider';
import { billingService, clientsService } from '@/services';
import { PLANS, planAmountLabel } from '@shared/catalog';
import { formatDate, formatMoney, formatMoneyPrecise, titleCase } from '@/lib/format';
import type { Invoice } from '@/types';

const STATUSES = ['draft', 'open', 'paid', 'void', 'uncollectible'];

/** Invoices (spec §124): generate, mark paid, inspect GST. */
export default function Invoices() {
  usePageMeta({ title: 'Invoices', noIndex: true });
  const toast = useToast();
  const [status, setStatusFilter] = useState('');
  const [query, setQuery] = useState('');
  const [detail, setDetail] = useState<Invoice | null>(null);
  const [generating, setGenerating] = useState(false);
  const [invoiceClientId, setInvoiceClientId] = useState('');
  const [invoicePlanId, setInvoicePlanId] = useState('');
  const [invoiceSubId, setInvoiceSubId] = useState('');

  const state = useAsync(() => billingService.invoices(), []);
  const subs = useAsync(() => billingService.subscriptions(), []);
  const clients = useAsync(() => clientsService.list({ pageSize: 1000 }), []);
  const clientName = (id: string) => clients.data?.items.find((client) => client.id === id)?.businessName ?? 'Unknown';

  /** Subscriptions belonging to the selected client (often none, early on). */
  const clientSubs = (subs.data?.items ?? []).filter((subscription) => subscription.clientId === invoiceClientId);

  const items = (state.data?.items ?? []).filter((invoice) => {
    const matchesQuery = !query || invoice.number.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (!status || invoice.status === status);
  });

  const outstanding = items.filter((invoice) => invoice.status !== 'paid').reduce((sum, invoice) => sum + invoice.total, 0);
  const collected = items.filter((invoice) => invoice.status === 'paid').reduce((sum, invoice) => sum + invoice.total, 0);

  const generate = useMutation(
    () =>
      // Prefer the client+plan path: it works with or without a subscription
      // record, so an invoice can always be raised.
      invoiceSubId
        ? billingService.generateInvoice(invoiceSubId)
        : billingService.createInvoice({
            clientId: invoiceClientId,
            planId: invoicePlanId,
            subscriptionId: null,
          }),
    {
      onSuccess: async () => {
        toast.success('Invoice generated');
        setGenerating(false);
        setInvoiceClientId('');
        setInvoicePlanId('');
        setInvoiceSubId('');
        await state.refetch().catch(() => undefined);
      },
    },
  );

  const setStatus = useMutation(
    (input: { id: string; status: string }) => billingService.updateInvoice(input.id, input.status),
    {
      onSuccess: async () => {
        toast.success('Invoice updated');
        await state.refetch().catch(() => undefined);
      },
    },
  );

  return (
    <div>
      <AdminHeader
        title="Invoices"
        description="GST-compliant invoices, generated from active subscriptions."
        crumbs={[{ label: 'Billing', to: '/app/invoices' }, { label: 'Invoices' }]}
        action={
          <Button size="md" iconLeft={<FilePlus2 className="h-3.5 w-3.5" />} onClick={() => setGenerating(true)}>
            Generate invoice
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <KpiCard label="Collected" value={formatMoney(collected, { compact: true })} />
        <KpiCard label="Outstanding" value={formatMoney(outstanding, { compact: true })} />
        <KpiCard label="Invoices" value={items.length} />
      </div>

      <ListToolbar
        search={query}
        onSearch={setQuery}
        searchPlaceholder="Search invoice number…"
        filters={[
          {
            label: 'Status',
            value: status,
            onChange: setStatusFilter,
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
              {items.map((invoice) => (
                <li key={invoice.id}>
                  <button
                    type="button"
                    onClick={() => setDetail(invoice)}
                    className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-elevated"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-[13px] font-medium text-fg">{invoice.number}</span>
                      <span className="block truncate text-2xs text-muted">
                        {clientName(invoice.clientId)} · issued {formatDate(invoice.issuedAt)}
                      </span>
                    </span>
                    <span className="shrink-0 text-2xs text-faint">Due {formatDate(invoice.dueAt)}</span>
                    <Badge tone={invoice.status === 'paid' ? 'success' : invoice.status === 'open' ? 'warning' : 'neutral'}>
                      {titleCase(invoice.status)}
                    </Badge>
                    <span className="nf-num w-24 shrink-0 text-right text-[13px] font-semibold text-fg">
                      {formatMoney(invoice.total)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        ) : (
          <EmptyState
            title="No invoices yet"
            description="Generate one from an active subscription."
            icon={<FilePlus2 className="h-4 w-4" />}
            action={
              <Button variant="secondary" size="sm" onClick={() => setGenerating(true)}>
                Generate invoice
              </Button>
            }
          />
        )}
      </AsyncBoundary>

      <Drawer open={!!detail} onClose={() => setDetail(null)} title={detail?.number ?? 'Invoice'} width="md">
        {detail ? (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[15px] font-semibold text-fg">{detail.number}</p>
                <p className="text-[13px] text-muted">{clientName(detail.clientId)}</p>
              </div>
              <Badge tone={detail.status === 'paid' ? 'success' : 'warning'}>{titleCase(detail.status)}</Badge>
            </div>

            <div>
              <p className="nf-eyebrow mb-2">Line items</p>
              <div className="overflow-hidden rounded border border-line">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-line bg-sunken/40 text-left text-2xs uppercase tracking-wider text-faint">
                      <th className="px-3 py-2 font-medium">Description</th>
                      <th className="px-3 py-2 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.lineItems.length ? (
                      detail.lineItems.map((item, index) => (
                        <tr key={`${item.description}-${index}`} className="border-b border-line last:border-0">
                          <td className="px-3 py-2 text-fg">{item.description}</td>
                          <td className="nf-num px-3 py-2 text-right text-fg">{formatMoneyPrecise(item.amount)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={2} className="px-3 py-3 text-muted">No line items recorded.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <Row label="Subtotal" value={formatMoneyPrecise(detail.amount)} />
              <Row label="GST" value={formatMoneyPrecise(detail.tax)} />
              <Row label="Total" value={formatMoneyPrecise(detail.total)} />
              <Row label="Issued" value={formatDate(detail.issuedAt)} />
              <Row label="Due" value={formatDate(detail.dueAt)} />
              {detail.paidAt ? <Row label="Paid" value={formatDate(detail.paidAt)} /> : null}
            </div>

            {detail.status !== 'paid' ? (
              <Button
                size="sm"
                onClick={() => void setStatus.mutate({ id: detail.id, status: 'paid' }).catch(() => undefined)}
                loading={setStatus.pending}
              >
                Mark as paid
              </Button>
            ) : null}

            <Link to="/app/payments" className="inline-block text-[13px] text-brand hover:underline">
              View payments →
            </Link>
          </div>
        ) : null}
      </Drawer>

      <Modal open={generating} onClose={() => setGenerating(false)} title="Generate an invoice">
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            await generate.mutate().catch(() => undefined);
          }}
          className="space-y-4"
        >
          <ClientSelect
            label="Client"
            value={invoiceClientId}
            onChange={(clientId) => {
              setInvoiceClientId(clientId);
              setInvoiceSubId('');
            }}
            required
          />

          <Select
            label="Plan"
            value={invoicePlanId}
            onChange={(event) => setInvoicePlanId(event.target.value)}
            required
            options={[
              { value: '', label: 'Choose a plan…' },
              ...PLANS.filter((plan) => plan.amount !== null).map((plan) => ({
                value: plan.id,
                label: `${plan.name} — ${planAmountLabel(plan)}/mo`,
              })),
            ]}
            hint="Amount and 18% GST are taken from the catalog — never typed by hand."
          />

          {invoiceClientId ? (
            clientSubs.length ? (
              <Select
                label="Subscription (optional)"
                value={invoiceSubId}
                onChange={(event) => setInvoiceSubId(event.target.value)}
                options={[
                  { value: '', label: 'No subscription — invoice the plan above' },
                  ...clientSubs.map((subscription) => ({
                    value: subscription.id,
                    label: `${titleCase(subscription.status)} · started ${formatDate(subscription.startedAt)}`,
                  })),
                ]}
                hint="Picking a subscription bills its own plan and links the invoice to it."
              />
            ) : (
              <p className="rounded border border-line bg-sunken/40 px-3 py-2 text-xs text-muted">
                This client has no subscription record yet — the invoice will be created from the plan you chose.{' '}
                <Link to="/app/subscriptions" className="text-brand hover:underline">
                  Add a subscription
                </Link>
              </p>
            )
          ) : null}

          {generate.error ? <p className="text-xs text-danger">{generate.error}</p> : null}
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button variant="ghost" size="sm" onClick={() => setGenerating(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              type="submit"
              loading={generate.pending}
              disabled={!invoiceClientId || !(invoiceSubId || invoicePlanId)}
            >
              Generate
            </Button>
          </div>
        </form>
      </Modal>
    </div>
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
