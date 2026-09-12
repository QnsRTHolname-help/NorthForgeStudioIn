import { useState } from 'react';
import { Download } from 'lucide-react';
import { Panel } from '@/components/ui/Card';
import { AsyncBoundary, EmptyState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Badge';
import { PortalHeader, MetricRow } from '@/components/portal/PortalHeader';
import { Drawer } from '@/components/ui/Modal';
import { Segmented } from '@/components/ui/Tabs';
import { useAsync } from '@/hooks/useAsync';
import { usePageMeta } from '@/hooks/usePageMeta';
import { billingService } from '@/services';
import { formatMoney, formatMoneyPrecise, formatDate, titleCase } from '@/lib/format';
import type { Invoice } from '@/types';

/** Invoices (spec §124): amounts, GST and payment state, in rupees. */
export default function Invoices() {
  usePageMeta({ title: 'Invoices', noIndex: true });
  const [filter, setFilter] = useState<'all' | 'unpaid' | 'paid'>('all');
  const [detail, setDetail] = useState<Invoice | null>(null);

  const state = useAsync(() => billingService.invoices(), []);
  const payments = useAsync(() => billingService.payments(), []);
  const items = state.data?.items ?? [];

  const filtered = items.filter((invoice) =>
    filter === 'paid' ? invoice.status === 'paid' : filter === 'unpaid' ? invoice.status !== 'paid' : true,
  );

  const outstanding = items
    .filter((invoice) => invoice.status !== 'paid')
    .reduce((sum, invoice) => sum + invoice.total, 0);
  const paid = items.filter((invoice) => invoice.status === 'paid').reduce((sum, invoice) => sum + invoice.total, 0);

  return (
    <div>
      <PortalHeader title="Invoices" description="Every invoice we have raised, and what is still outstanding." />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented
          value={filter}
          onChange={(value) => setFilter(value as typeof filter)}
          options={[
            { value: 'all', label: 'All' },
            { value: 'unpaid', label: 'Unpaid' },
            { value: 'paid', label: 'Paid' },
          ]}
          size="sm"
          ariaLabel="Invoice filter"
        />
        <div className="flex gap-4 text-[13px] text-muted">
          <span>
            Outstanding <span className="nf-num font-medium text-fg">{formatMoney(outstanding)}</span>
          </span>
          <span>
            Paid <span className="nf-num font-medium text-success">{formatMoney(paid)}</span>
          </span>
        </div>
      </div>

      <AsyncBoundary
        loading={state.loading}
        error={state.error}
        data={state.data}
        onRetry={() => state.refetch().catch(() => undefined)}
      >
        {filtered.length ? (
          <div className="overflow-hidden rounded-lg border border-line bg-surface">
            <ul className="divide-y divide-line">
              {filtered.map((invoice) => (
                <li key={invoice.id}>
                  <button
                    type="button"
                    onClick={() => setDetail(invoice)}
                    className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-elevated"
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-[13px] font-medium text-fg">{invoice.number}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        Issued {formatDate(invoice.issuedAt)} · Due {formatDate(invoice.dueAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {invoice.isDemo ? <Badge tone="neutral">Demo</Badge> : null}
                      <Badge tone={invoice.status === 'paid' ? 'success' : invoice.status === 'open' ? 'warning' : 'neutral'}>
                        {titleCase(invoice.status)}
                      </Badge>
                      <span className="nf-num text-[15px] font-semibold text-fg">{formatMoney(invoice.total)}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <EmptyState
            title="No invoices yet"
            description="Your first invoice is raised when your subscription starts."
          />
        )}
      </AsyncBoundary>

      {payments.data?.items?.length ? (
        <div className="mt-6">
          <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-fg">Payments received</h2>
          <div className="overflow-hidden rounded-lg border border-line bg-surface">
            <ul className="divide-y divide-line">
              {payments.data.items.map((payment) => (
                <li key={payment.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="text-[13px] text-fg">{formatDate(payment.paidAt)}</p>
                    <p className="text-xs text-muted">{payment.method ? titleCase(payment.method) : 'Payment'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone={payment.status === 'succeeded' ? 'success' : 'danger'}>{titleCase(payment.status)}</Badge>
                    <span className="nf-num text-[13px] font-medium text-fg">{formatMoney(payment.amount)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <Drawer open={!!detail} onClose={() => setDetail(null)} title={detail?.number ?? 'Invoice'} width="md">
        {detail ? (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[15px] font-semibold text-fg">{detail.number}</p>
                <p className="text-xs text-muted">Issued {formatDate(detail.issuedAt)}</p>
              </div>
              <Badge tone={detail.status === 'paid' ? 'success' : 'warning'}>{titleCase(detail.status)}</Badge>
            </div>

            <div>
              <p className="nf-eyebrow mb-2">Line items</p>
              <div className="overflow-hidden rounded border border-line">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-line bg-sunken/40 text-left text-2xs uppercase tracking-wider text-faint">
                      <th className="px-3 py-2 font-medium">Item</th>
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
                        <td colSpan={2} className="px-3 py-3 text-muted">
                          No line items recorded.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <MetricRow label="Subtotal" value={formatMoneyPrecise(detail.amount)} />
              <MetricRow label="GST" value={formatMoneyPrecise(detail.tax)} />
              <MetricRow label="Total" value={formatMoneyPrecise(detail.total)} />
              <MetricRow label="Due" value={formatDate(detail.dueAt)} />
              {detail.paidAt ? <MetricRow label="Paid" value={formatDate(detail.paidAt)} tone="success" /> : null}
            </div>

            <button
              type="button"
              onClick={() => window.print()}
              className="nf-focus inline-flex h-9 items-center gap-2 rounded-md border border-line px-3.5 text-[13px] font-medium text-fg transition-colors hover:bg-elevated"
            >
              <Download className="h-3.5 w-3.5" aria-hidden /> Print / save as PDF
            </button>
          </div>
        ) : null}
      </Drawer>

      <Panel className="mt-6" title="About GST">
        <p className="text-[13px] leading-relaxed text-muted">
          Invoices show GST as a separate line. Amounts are stored in paise so nothing is rounded twice — what you see
          here is exactly what the ledger holds.
        </p>
      </Panel>
    </div>
  );
}
