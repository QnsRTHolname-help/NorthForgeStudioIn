import { useState } from 'react';
import { CreditCard, FilePlus2, Trash2 } from 'lucide-react';
import { Panel, KpiCard } from '@/components/ui/Card';
import { AsyncBoundary, EmptyState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Badge';
import { AdminHeader, ListToolbar } from '@/components/admin/AdminHeader';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { Checkbox, Input, Select } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useToast } from '@/app/providers/ToastProvider';
import { billingService, clientsService } from '@/services';
import { formatDate, formatMoney, titleCase } from '@/lib/format';
import type { PaymentStatus } from '@/types';

/** Payments (spec §124): money actually received. */
export default function Payments() {
  usePageMeta({ title: 'Payments', noIndex: true });
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [settleInvoice, setSettleInvoice] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const state = useAsync(() => billingService.payments(), []);
  const clients = useAsync(() => clientsService.list({ pageSize: 200 }), []);
  const invoices = useAsync(() => billingService.invoices(), []);
  /** See Invoices: a retained payment keeps its snapshotted business name. */
  const clientName = (id: string, billedTo?: string | null) =>
    clients.data?.items.find((client) => client.id === id)?.businessName ??
    billedTo ??
    (id ? 'Unknown' : 'Closed account — retained');

  const record = useMutation(
    (input: { clientId: string; amount: number; status: string; method: string; invoiceId: string }) =>
      billingService.createPayment({
        clientId: input.clientId,
        amount: input.amount,
        status: input.status as PaymentStatus,
        method: input.method,
        invoiceId: input.invoiceId || undefined,
        markInvoicePaid: settleInvoice,
      }),
    {
      onSuccess: async (result) => {
        toast.success(
          'Payment recorded',
          result.invoiceSettled ? 'The linked invoice is now marked paid.' : undefined,
        );
        setCreating(false);
        await Promise.all([
          state.refetch().catch(() => undefined),
          result.invoiceSettled ? invoices.refetch().catch(() => undefined) : Promise.resolve(),
        ]);
      },
    },
  );

  const remove = useMutation((id: string) => billingService.deletePayment(id), {
    onSuccess: async () => {
      toast.success('Payment deleted');
      setConfirmDelete(null);
      await state.refetch().catch(() => undefined);
    },
  });

  const items = (state.data?.items ?? []).filter((payment) =>
    !query ? true : clientName(payment.clientId, payment.billedTo).toLowerCase().includes(query.toLowerCase()),
  );

  const succeeded = items.filter((payment) => payment.status === 'succeeded');
  const total = succeeded.reduce((sum, payment) => sum + payment.amount, 0);
  const failed = items.filter((payment) => payment.status === 'failed').length;

  return (
    <div>
      <AdminHeader
        title="Payments"
        description="Money received, with method and status for every transaction."
        crumbs={[{ label: 'Billing', to: '/app/invoices' }, { label: 'Payments' }]}
        action={
          <Button size="md" iconLeft={<FilePlus2 className="h-3.5 w-3.5" />} onClick={() => setCreating(true)}>
            Record payment
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <KpiCard label="Collected" value={formatMoney(total, { compact: true })} icon={<CreditCard className="h-4 w-4" />} />
        <KpiCard label="Transactions" value={items.length} />
        <KpiCard label="Failed" value={failed} hint={failed ? 'Needs follow-up' : 'None'} />
      </div>

      <ListToolbar search={query} onSearch={setQuery} searchPlaceholder="Search by client…" />

      <AsyncBoundary
        loading={state.loading}
        error={state.error}
        data={state.data}
        onRetry={() => state.refetch().catch(() => undefined)}
      >
        {items.length ? (
          <Panel bodyClassName="p-0">
            <ul className="divide-y divide-line">
              {items.map((payment) => (
                <li key={payment.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-fg">
                      {clientName(payment.clientId, payment.billedTo)}
                    </span>
                    <span className="block text-2xs text-muted">
                      {payment.method ? titleCase(payment.method) : 'Payment'} · {formatDate(payment.paidAt)}
                    </span>
                  </span>
                  <Badge
                    tone={
                      payment.status === 'succeeded'
                        ? 'success'
                        : payment.status === 'failed'
                          ? 'danger'
                          : payment.status === 'refunded'
                            ? 'warning'
                            : 'neutral'
                    }
                  >
                    {titleCase(payment.status)}
                  </Badge>
                  <span className="nf-num w-24 shrink-0 text-right text-[13px] font-semibold text-fg">
                    {formatMoney(payment.amount)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(payment.id)}
                    className="shrink-0 rounded p-1.5 text-faint transition-colors hover:bg-sunken hover:text-danger"
                    aria-label={`Delete payment for ${clientName(payment.clientId, payment.billedTo)}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        ) : (
          <EmptyState
            title="No payments recorded"
            description="Payments appear here once clients settle an invoice."
            icon={<CreditCard className="h-4 w-4" />}
          />
        )}
      </AsyncBoundary>

      <Panel className="mt-6" title="Currency handling">
        <p className="text-[13px] leading-relaxed text-muted">
          All amounts are stored in paise as integers and formatted once, here at the edge. That avoids the rounding drift
          you get from storing rupees as floats — the ledger always reconciles to the paisa.
        </p>
      </Panel>

      <Modal open={creating} onClose={() => setCreating(false)} title="Record a payment">
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const rupees = Number(data.get('amount') ?? 0);
            if (!rupees || rupees <= 0) return;
            await record
              .mutate({
                clientId: String(data.get('clientId') ?? ''),
                amount: Math.round(rupees * 100),
                status: String(data.get('status') ?? 'succeeded'),
                method: String(data.get('method') ?? 'manual'),
                invoiceId: String(data.get('invoiceId') ?? ''),
              })
              .catch(() => undefined);
          }}
          className="space-y-4"
        >
          <Select
            label="Client"
            name="clientId"
            required
            options={[
              { value: '', label: 'Select a client…' },
              ...(clients.data?.items ?? []).map((client) => ({ value: client.id, label: client.businessName })),
            ]}
          />
          <Input label="Amount (₹)" name="amount" type="number" min="1" step="0.01" required placeholder="15000" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Status"
              name="status"
              defaultValue="succeeded"
              options={[
                { value: 'succeeded', label: 'Succeeded' },
                { value: 'pending', label: 'Pending' },
                { value: 'failed', label: 'Failed' },
                { value: 'refunded', label: 'Refunded' },
              ]}
            />
            <Select
              label="Method"
              name="method"
              defaultValue="bank_transfer"
              options={[
                { value: 'bank_transfer', label: 'Bank transfer' },
                { value: 'upi', label: 'UPI' },
                { value: 'cash', label: 'Cash' },
                { value: 'cheque', label: 'Cheque' },
                { value: 'gateway', label: 'Payment gateway' },
              ]}
            />
          </div>
          <Select
            label="Link to invoice (optional)"
            name="invoiceId"
            options={[
              { value: '', label: 'No invoice' },
              ...(invoices.data?.items ?? []).map((invoice) => ({
                value: invoice.id,
                label: `${invoice.number} · ${titleCase(invoice.status)}`,
              })),
            ]}
            hint="Linking a payment keeps the invoice and the ledger reconciled."
          />
          <Checkbox
            checked={settleInvoice}
            onChange={setSettleInvoice}
            label="Mark the linked invoice as paid"
            description="On by default: money received means the invoice is settled. Untick to record a part payment."
          />
          {record.error ? <p className="text-xs text-danger">{record.error}</p> : null}
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button size="sm" type="submit" loading={record.pending}>
              Record payment
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (!confirmDelete) return;
          await remove.mutate(confirmDelete).catch(() => undefined);
        }}
        title="Delete this payment?"
        description="Use this only for a payment recorded by mistake. The linked invoice stays as it is."
        confirmLabel="Delete payment"
        destructive
        pending={remove.pending}
      />
    </div>
  );
}
