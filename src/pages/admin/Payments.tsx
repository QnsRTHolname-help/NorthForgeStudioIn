import { useState } from 'react';
import { CreditCard } from 'lucide-react';
import { Panel, KpiCard } from '@/components/ui/Card';
import { AsyncBoundary, EmptyState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Badge';
import { AdminHeader, ListToolbar } from '@/components/admin/AdminHeader';
import { useAsync } from '@/hooks/useAsync';
import { usePageMeta } from '@/hooks/usePageMeta';
import { billingService, clientsService } from '@/services';
import { formatDate, formatMoney, titleCase } from '@/lib/format';

/** Payments (spec §124): money actually received. */
export default function Payments() {
  usePageMeta({ title: 'Payments', noIndex: true });
  const [query, setQuery] = useState('');

  const state = useAsync(() => billingService.payments(), []);
  const clients = useAsync(() => clientsService.list({ pageSize: 200 }), []);
  const clientName = (id: string) => clients.data?.items.find((client) => client.id === id)?.businessName ?? 'Unknown';

  const items = (state.data?.items ?? []).filter((payment) =>
    !query ? true : clientName(payment.clientId).toLowerCase().includes(query.toLowerCase()),
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
                    <span className="block truncate text-[13px] font-medium text-fg">{clientName(payment.clientId)}</span>
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
    </div>
  );
}
