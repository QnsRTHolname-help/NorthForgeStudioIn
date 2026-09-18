import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FilePlus2, Pencil, Plus, Receipt, Trash2 } from 'lucide-react';
import { Panel, KpiCard } from '@/components/ui/Card';
import { AsyncBoundary, EmptyState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Badge';
import { AdminHeader, ListToolbar } from '@/components/admin/AdminHeader';
import { ConfirmDialog, Drawer, Modal } from '@/components/ui/Modal';
import { Checkbox, Input, Select } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { ClientSelect } from '@/components/admin/ClientSelect';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useToast } from '@/app/providers/ToastProvider';
import { billingService, clientsService } from '@/services';
import { getPlanById, PLANS, planAmountLabel } from '@shared/catalog';
import { GST_LABEL, billableLines, sumOwed, totalize, type InvoiceLine } from '@/lib/billing';
import { formatDate, formatMoney, formatMoneyPrecise, titleCase } from '@/lib/format';
import type { Invoice } from '@/types';

const STATUSES = ['draft', 'open', 'paid', 'void', 'uncollectible'];
const DUE_OPTIONS = [
  { value: '7', label: 'Due in 7 days' },
  { value: '14', label: 'Due in 14 days' },
  { value: '30', label: 'Due in 30 days' },
];

/**
 * Invoices (spec §124).
 *
 * Everything on this screen reconciles: the line items are the source of
 * truth, the subtotal is their sum, GST is 18% of that, and the total is
 * subtotal + tax (src/lib/billing.ts). The operator can raise an invoice,
 * include the one-time setup fee on a client's first bill, edit the lines,
 * reschedule the due date, settle it, or delete a mistake.
 */
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
  const [includeSetup, setIncludeSetup] = useState(false);
  const [dueInDays, setDueInDays] = useState('14');
  const [setupTouched, setSetupTouched] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editLines, setEditLines] = useState<InvoiceLine[]>([]);
  const [editDueAt, setEditDueAt] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<Invoice | null>(null);

  const state = useAsync(() => billingService.invoices(), []);
  const subs = useAsync(() => billingService.subscriptions(), []);
  const clients = useAsync(() => clientsService.list({ pageSize: 1000 }), []);
  /**
   * Who an invoice belongs to. An invoice whose client account was closed is
   * retained with its business name snapshotted (billed_to) and no live
   * client row — it must still read as attributable, not as "unknown".
   */
  const clientName = (id: string, billedTo?: string | null) =>
    clients.data?.items.find((client) => client.id === id)?.businessName ??
    billedTo ??
    (id ? 'Unknown client' : 'Closed account — retained');

  /** Subscriptions belonging to the selected client (often none, early on). */
  const clientSubs = (subs.data?.items ?? []).filter((subscription) => subscription.clientId === invoiceClientId);

  const items = (state.data?.items ?? []).filter((invoice) => {
    const needle = query.trim().toLowerCase();
    const matchesQuery =
      !needle ||
      invoice.number.toLowerCase().includes(needle) ||
      clientName(invoice.clientId, invoice.billedTo).toLowerCase().includes(needle);
    return matchesQuery && (!status || invoice.status === status);
  });

  const collected = items.filter((invoice) => invoice.status === 'paid').reduce((sum, invoice) => sum + invoice.total, 0);
  // Draft and void invoices are not money anyone owes — counting them made
  // "Outstanding" permanently wrong.
  const outstanding = sumOwed(items);
  const overdue = items.filter(
    (invoice) => invoice.status === 'open' && invoice.dueAt && new Date(invoice.dueAt).getTime() < Date.now(),
  ).length;

  /** The selected client's billing history decides the setup-fee default. */
  const clientHasBeenBilled = (state.data?.items ?? []).some(
    (invoice) => invoice.clientId === invoiceClientId && invoice.status !== 'void',
  );

  const previewPlan = getPlanById(invoicePlanId);
  const previewLines = previewPlan ? billableLines(previewPlan, { includeSetup }) : [];
  const preview = totalize(previewLines);

  /** Live totals while editing an invoice (rupees in the form → paise in state). */
  const editTotals = useMemo(() => totalize(editLines), [editLines]);

  const generate = useMutation(
    () =>
      // Prefer the client+plan path: it works with or without a subscription
      // record, so an invoice can always be raised.
      invoiceSubId
        ? billingService.generateInvoice(invoiceSubId, {
            includeSetup,
            dueInDays: Number(dueInDays),
          })
        : billingService.createInvoice({
            clientId: invoiceClientId,
            planId: invoicePlanId,
            subscriptionId: null,
            includeSetup,
            dueInDays: Number(dueInDays),
          }),
    {
      onSuccess: async () => {
        toast.success('Invoice generated');
        setGenerating(false);
        setInvoiceClientId('');
        setInvoicePlanId('');
        setInvoiceSubId('');
        setIncludeSetup(false);
        setSetupTouched(false);
        setDueInDays('14');
        await state.refetch().catch(() => undefined);
      },
    },
  );

  const patch = useMutation(
    (input: { id: string; status?: string; dueAt?: string; lineItems?: InvoiceLine[] }) => {
      const { id, ...rest } = input;
      return billingService.updateInvoice(id, rest);
    },
    {
      onSuccess: async (result) => {
        toast.success('Invoice updated');
        setDetail(result.invoice);
        setEditing(false);
        await state.refetch().catch(() => undefined);
      },
    },
  );

  const remove = useMutation((id: string) => billingService.deleteInvoice(id), {
    onSuccess: async () => {
      toast.success('Invoice deleted');
      setConfirmDelete(null);
      setDetail(null);
      setEditing(false);
      await state.refetch().catch(() => undefined);
    },
  });

  const openDetail = (invoice: Invoice) => {
    setDetail(invoice);
    setEditing(false);
  };

  const startEdit = (invoice: Invoice) => {
    setEditLines(invoice.lineItems.length ? invoice.lineItems.map((line) => ({ ...line })) : []);
    setEditDueAt(invoice.dueAt ? invoice.dueAt.slice(0, 10) : '');
    setEditing(true);
  };

  const updateLine = (index: number, patchLine: Partial<InvoiceLine>) => {
    setEditLines((lines) => lines.map((line, i) => (i === index ? { ...line, ...patchLine } : line)));
  };

  return (
    <div>
      <AdminHeader
        title="Invoices"
        description="GST invoices built from catalog pricing — setup fee, management cycle and 18% GST, always reconciled."
        crumbs={[{ label: 'Billing', to: '/app/invoices' }, { label: 'Invoices' }]}
        action={
          <Button size="md" iconLeft={<FilePlus2 className="h-3.5 w-3.5" />} onClick={() => setGenerating(true)}>
            Generate invoice
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Collected" value={formatMoney(collected, { compact: true })} />
        <KpiCard label="Outstanding" value={formatMoney(outstanding, { compact: true })} hint="Open and uncollectible invoices" />
        <KpiCard label="Overdue" value={overdue} hint={overdue ? 'Past the due date' : 'Nothing overdue'} />
        <KpiCard label="Invoices" value={items.length} />
      </div>

      <ListToolbar
        search={query}
        onSearch={setQuery}
        searchPlaceholder="Search number or client…"
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
        isEmpty={(data) => data.items.length === 0}
        onRetry={() => state.refetch().catch(() => undefined)}
        empty={
          <EmptyState
            title="No invoices yet"
            description="Generate the first one from the catalog — pick a client and a plan; the money is calculated for you."
            icon={<Receipt className="h-4 w-4" />}
            action={
              <Button variant="secondary" size="sm" onClick={() => setGenerating(true)}>
                Generate invoice
              </Button>
            }
          />
        }
      >
        {items.length ? (
          <Panel bodyClassName="p-0">
            <ul className="divide-y divide-line">
              {items.map((invoice) => (
                <li key={invoice.id}>
                  <button
                    type="button"
                    onClick={() => openDetail(invoice)}
                    className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-sunken/50"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-[13px] font-medium text-fg">{invoice.number}</span>
                      <span className="block truncate text-2xs text-muted">
                        {clientName(invoice.clientId, invoice.billedTo)} · {invoice.lineItems[0]?.label ?? 'No line items'}{' '}
                        · issued{' '}
                        {formatDate(invoice.issuedAt)}
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
            title="No invoices match"
            description="Clear the search or status filter to see everything."
            icon={<Receipt className="h-4 w-4" />}
          />
        )}
      </AsyncBoundary>

      <Drawer open={!!detail} onClose={() => { setDetail(null); setEditing(false); }} title={detail?.number ?? 'Invoice'} width="md">
        {detail ? (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[15px] font-semibold text-fg">{detail.number}</p>
                <p className="text-[13px] text-muted">{clientName(detail.clientId, detail.billedTo)}</p>
              </div>
              <Badge tone={detail.status === 'paid' ? 'success' : detail.status === 'open' ? 'warning' : 'neutral'}>
                {titleCase(detail.status)}
              </Badge>
            </div>

            {editing ? (
              <>
                <div>
                  <p className="nf-eyebrow mb-2">Line items</p>
                  <div className="space-y-3">
                    {editLines.map((line, index) => (
                      <div key={`line-${index}`} className="rounded border border-line bg-surface p-3">
                        <Input
                          label="Description"
                          value={line.label}
                          onChange={(event) => updateLine(index, { label: event.target.value })}
                        />
                        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                          <Input
                            label="Amount (₹)"
                            type="number"
                            min="0"
                            step="0.01"
                            value={Number.isFinite(line.amount) ? line.amount / 100 : ''}
                            onChange={(event) => updateLine(index, { amount: Math.round(Number(event.target.value || 0) * 100) })}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditLines((lines) => lines.filter((_, i) => i !== index))}
                            iconLeft={<Trash2 className="h-3.5 w-3.5" />}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                    <Button
                      variant="secondary"
                      size="sm"
                      iconLeft={<Plus className="h-3.5 w-3.5" />}
                      onClick={() => setEditLines((lines) => [...lines, { label: '', amount: 0 }])}
                    >
                      Add line item
                    </Button>
                  </div>
                </div>

                <Input
                  label="Due date"
                  type="date"
                  value={editDueAt}
                  onChange={(event) => setEditDueAt(event.target.value)}
                />

                <Totals totals={editTotals} />

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    loading={patch.pending}
                    onClick={() =>
                      void patch
                        .mutate({
                          id: detail.id,
                          lineItems: editLines.filter((line) => line.label.trim()),
                          dueAt: editDueAt ? new Date(`${editDueAt}T12:00:00`).toISOString() : undefined,
                        })
                        .catch(() => undefined)
                    }
                  >
                    Save changes
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div>
                  <p className="nf-eyebrow mb-2">Line items</p>
                  <Table className="rounded border border-line">
                    <THead>
                      <TR>
                        <TH>Description</TH>
                        <TH align="right">Amount</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {detail.lineItems.length ? (
                        detail.lineItems.map((line, index) => (
                          <TR key={`${line.label}-${index}`}>
                            <TD>
                              <span className="block font-medium text-fg">{line.label}</span>
                              {line.description ? (
                                <span className="mt-0.5 block text-2xs text-muted">{line.description}</span>
                              ) : null}
                            </TD>
                            <TD align="right" className="nf-num">
                              {formatMoneyPrecise(line.amount)}
                            </TD>
                          </TR>
                        ))
                      ) : (
                        <TR>
                          <TD className="text-muted">No line items recorded.</TD>
                          <TD align="right">—</TD>
                        </TR>
                      )}
                    </TBody>
                  </Table>
                </div>

                <Totals totals={{ subtotal: detail.amount, tax: detail.tax, total: detail.total }} />

                <div className="space-y-1">
                  <Row label="Issued" value={formatDate(detail.issuedAt)} />
                  <Row label="Due" value={formatDate(detail.dueAt)} />
                  {detail.paidAt ? <Row label="Paid" value={formatDate(detail.paidAt)} /> : null}
                  <Row label="Currency" value={detail.currency} />
                </div>

                <div className="flex flex-wrap gap-2">
                  {detail.status !== 'paid' ? (
                    <Button
                      size="sm"
                      loading={patch.pending}
                      onClick={() => void patch.mutate({ id: detail.id, status: 'paid' }).catch(() => undefined)}
                    >
                      Mark as paid
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={patch.pending}
                      onClick={() => void patch.mutate({ id: detail.id, status: 'open' }).catch(() => undefined)}
                    >
                      Re-open invoice
                    </Button>
                  )}
                  <Button variant="secondary" size="sm" iconLeft={<Pencil className="h-3.5 w-3.5" />} onClick={() => startEdit(detail)}>
                    Edit lines
                  </Button>
                  <Select
                    aria-label="Invoice status"
                    value={detail.status}
                    onChange={(event) => void patch.mutate({ id: detail.id, status: event.target.value }).catch(() => undefined)}
                    options={STATUSES.map((value) => ({ value, label: titleCase(value) }))}
                    className="w-auto"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-danger"
                    iconLeft={<Trash2 className="h-3.5 w-3.5" />}
                    onClick={() => setConfirmDelete(detail)}
                  >
                    Delete
                  </Button>
                </div>
              </>
            )}

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
              // Default the setup fee from history: first bill carries it.
              if (!setupTouched) {
                setIncludeSetup(
                  !(state.data?.items ?? []).some(
                    (invoice) => invoice.clientId === clientId && invoice.status !== 'void',
                  ),
                );
              }
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
            hint="Amounts come from the shared catalog — never typed by hand."
          />

          <Checkbox
            checked={includeSetup}
            onChange={(next) => {
              setSetupTouched(true);
              setIncludeSetup(next);
            }}
            label="Include the one-time setup fee"
            description={
              clientHasBeenBilled
                ? 'This client has been billed before — leave this off for a recurring cycle.'
                : 'First invoice for this client: charge the build fee plus the first management cycle.'
            }
          />

          <Select label="Payment terms" value={dueInDays} onChange={(event) => setDueInDays(event.target.value)} options={DUE_OPTIONS} />

          {invoiceClientId ? (
            clientSubs.length ? (
              <Select
                label="Link to subscription (optional)"
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

          {previewPlan ? (
            <div className="rounded border border-line bg-sunken/30 p-4">
              <p className="nf-eyebrow mb-3">Preview</p>
              <ul className="space-y-1.5">
                {previewLines.map((line) => (
                  <li key={line.label} className="flex items-baseline justify-between gap-4 text-[13px]">
                    <span className="text-muted">{line.label}</span>
                    <span className="nf-num text-fg">{formatMoneyPrecise(line.amount)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 border-t border-line pt-3">
                <Totals totals={preview} compact />
              </div>
            </div>
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

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (!confirmDelete) return;
          await remove.mutate(confirmDelete.id).catch(() => undefined);
        }}
        title="Delete this invoice?"
        description={
          <>
            {confirmDelete?.number} will be removed permanently. To keep the audit trail instead, set its status to{' '}
            <strong>void</strong>.
          </>
        }
        confirmLabel="Delete invoice"
        destructive
        pending={remove.pending}
      />
    </div>
  );
}

/** Subtotal → GST → Total, in one place, from the line items. */
function Totals({
  totals,
  compact,
}: {
  totals: { subtotal: number; tax: number; total: number };
  compact?: boolean;
}) {
  return (
    <div className={compact ? 'space-y-1' : 'space-y-1 rounded border border-line bg-sunken/30 p-4'}>
      <Row label="Subtotal" value={formatMoneyPrecise(totals.subtotal)} />
      <Row label={GST_LABEL} value={formatMoneyPrecise(totals.tax)} />
      <div className="border-t border-line pt-2">
        <Row label="Total" value={<span className="text-[15px] font-semibold">{formatMoneyPrecise(totals.total)}</span>} />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="text-[13px] text-muted">{label}</span>
      <span className="nf-num text-right text-[13px] font-medium text-fg">{value}</span>
    </div>
  );
}
