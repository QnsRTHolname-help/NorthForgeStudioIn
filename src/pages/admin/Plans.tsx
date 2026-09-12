import { KpiCard, Panel } from '@/components/ui/Card';
import { AsyncBoundary, EmptyState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Badge';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { useAsync } from '@/hooks/useAsync';
import { usePageMeta } from '@/hooks/usePageMeta';
import { billingService } from '@/services';
import { BILLING_INTERVAL_DAYS, THIRD_PARTY_COSTS } from '@shared/catalog';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/cn';

/**
 * Plans (spec §123).
 * Plan amounts come from the shared catalog so the public site, the portal
 * and the invoice generator can never disagree.
 */
export default function Plans() {
  usePageMeta({ title: 'Plans', noIndex: true });
  const state = useAsync(() => billingService.plans(), []);
  const plans = state.data?.plans ?? [];

  const subscribers = plans.reduce((sum, plan) => sum + plan.subscribers, 0);
  const mrr = plans.reduce((sum, plan) => sum + (plan.amount ?? 0) * plan.subscribers, 0);

  return (
    <div>
      <AdminHeader
        title="Plans"
        description="What each plan costs, what it includes, and how many clients are on it."
        crumbs={[{ label: 'Billing', to: '/app/invoices' }, { label: 'Plans' }]}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <KpiCard label="Plans" value={plans.length} />
        <KpiCard label="Subscribers" value={subscribers} />
        <KpiCard label="Recurring / cycle" value={formatMoney(mrr, { compact: true })} />
      </div>

      <AsyncBoundary
        loading={state.loading}
        error={state.error}
        data={state.data}
        onRetry={() => state.refetch().catch(() => undefined)}
      >
        {plans.length ? (
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={cn(
                  'flex flex-col rounded-lg border bg-surface p-4',
                  plan.recommended ? 'border-brand/50' : 'border-line',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[15px] font-semibold text-fg">{plan.name}</p>
                    <p className="text-2xs uppercase tracking-wider text-faint">{plan.slug}</p>
                  </div>
                  {plan.recommended ? <Badge tone="info">Recommended</Badge> : null}
                </div>

                <p className="mt-4 nf-num text-[24px] font-semibold text-fg">
                  {plan.amount === null ? 'Custom' : formatMoney(plan.amount)}
                  {plan.amount !== null ? (
                    <span className="ml-1 text-[13px] font-normal text-faint">/ {plan.intervalDays}d</span>
                  ) : null}
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-muted">{plan.tagline}</p>

                <ul className="mt-4 flex-1 space-y-1.5 border-t border-line pt-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="text-[13px] leading-relaxed text-muted">
                      · {feature}
                    </li>
                  ))}
                </ul>

                <p className="mt-4 border-t border-line pt-3 text-2xs text-faint">
                  {plan.subscribers} subscriber{plan.subscribers === 1 ? '' : 's'}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No plans configured" description="Plans are defined in the shared catalog." />
        )}
      </AsyncBoundary>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Billing rules">
          <ul className="space-y-2 text-[13px] leading-relaxed text-muted">
            <li>· Billed every {BILLING_INTERVAL_DAYS} days, in advance.</li>
            <li>· Amounts stored in paise; formatted only for display.</li>
            <li>· Plan changes apply from the next cycle, never mid-cycle.</li>
            <li>· GST is shown as a separate line on every invoice.</li>
          </ul>
        </Panel>

        <Panel title="Third-party costs (pass-through)">
          <ul className="space-y-2">
            {THIRD_PARTY_COSTS.map((cost) => (
              <li key={cost.label} className="flex items-baseline justify-between gap-3 border-b border-line py-2 last:border-0">
                <span className="text-[13px] text-fg">{cost.label}</span>
                <span className="text-right text-[13px] text-muted">{cost.note}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
