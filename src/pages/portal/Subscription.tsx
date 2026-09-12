import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { Panel, KpiCard } from '@/components/ui/Card';
import { AsyncBoundary, EmptyState } from '@/components/ui/States';
import { Badge, StatusIndicator } from '@/components/ui/Badge';
import { PortalHeader, MetricRow, Explain } from '@/components/portal/PortalHeader';
import { Modal } from '@/components/ui/Modal';
import { Input, Select } from '@/components/ui/Form';
import { Button, LinkButton } from '@/components/ui/Button';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useToast } from '@/app/providers/ToastProvider';
import { billingService, requestsService } from '@/services';
import { formatMoney, formatDate, formatDaysUntil } from '@/lib/format';

/**
 * Subscription (spec §112, §123).
 *
 * Plan changes are raised as requests rather than applied instantly — the
 * switch is then made by the team and applied from the next cycle, which is
 * the honest version of "change your plan any time".
 */
export default function Subscription() {
  usePageMeta({ title: 'My subscription', noIndex: true });
  const toast = useToast();
  const [requesting, setRequesting] = useState(false);

  const subs = useAsync(() => billingService.subscriptions(), []);
  const plans = useAsync(() => billingService.plans(), []);
  const invoices = useAsync(() => billingService.invoices(), []);

  const subscription = subs.data?.items?.[0] ?? null;
  const plan = plans.data?.plans?.find((item) => item.id === subscription?.planId) ?? null;

  return (
    <div>
      <PortalHeader
        title="My subscription"
        description="Your plan, renewal date and billing history."
        demo={subscription?.isDemo}
        action={
          subscription ? (
            <Button size="sm" onClick={() => setRequesting(true)}>
              Request a plan change
            </Button>
          ) : undefined
        }
      />

      <AsyncBoundary
        loading={subs.loading}
        error={subs.error}
        data={subs.data}
        onRetry={() => subs.refetch().catch(() => undefined)}
        empty={
          <EmptyState
            title="No active subscription"
            description="Your subscription is created when your engagement starts. Until then, nothing is billed."
            action={
              <LinkButton to="/pricing" variant="secondary" size="sm">
                See plans
              </LinkButton>
            }
          />
        }
      >
        {subscription ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard label="Plan" value={plan?.name ?? 'Custom'} hint={plan?.tagline} />
              <KpiCard
                label="Amount"
                value={plan?.amount !== null && plan?.amount !== undefined ? `${formatMoney(plan.amount)} / ${plan.intervalDays} days` : 'Custom'}
                hint="Billed in advance"
              />
              <KpiCard
                label="Renews"
                value={formatDate(subscription.renewsAt)}
                hint={formatDaysUntil(subscription.renewsAt) ?? undefined}
              />
              <KpiCard
                label="Status"
                value={<StatusIndicator status={subscription.status} tone={subscription.status === 'active' ? 'success' : 'warning'} />}
                hint="Billed monthly"
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
              <Panel title="What your plan includes">
                {plan?.features.length ? (
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-[13px] leading-relaxed text-muted">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden />
                        {feature}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[13px] text-muted">
                    Your plan is customised. Raise a request if you would like the details listed out.
                  </p>
                )}
              </Panel>

              <div className="space-y-4">
                <Panel title="Billing details">
                  <MetricRow label="Started" value={formatDate(subscription.startedAt)} />
                  <MetricRow label="Next renewal" value={formatDate(subscription.renewsAt)} />
                  <MetricRow label="Seats" value={subscription.seats} />
                  <MetricRow
                    label="Invoices"
                    value={
                      <Link to="/portal/invoices" className="text-brand hover:underline">
                        {invoices.data?.items?.length ?? 0} total
                      </Link>
                    }
                  />
                  {subscription.cancelAt ? (
                    <MetricRow label="Cancels" value={formatDate(subscription.cancelAt)} tone="warning" />
                  ) : null}
                </Panel>

                <Explain title="Changing plan">
                  Upgrades and downgrades are applied from your next billing cycle. Request the change here and we will
                  confirm it before it takes effect — no surprise charges.
                </Explain>
              </div>
            </div>

            {plan ? (
              <div className="flex flex-wrap items-center gap-2">
                {plans.data?.plans
                  ?.filter((item) => item.id !== plan.id)
                  .map((item) => (
                    <Badge key={item.id} tone="neutral">
                      {item.name} · {item.amount !== null ? formatMoney(item.amount) : 'Custom'}
                    </Badge>
                  ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </AsyncBoundary>

      <Modal open={requesting} onClose={() => setRequesting(false)} title="Request a plan change">
        <PlanChangeRequest
          currentPlan={plan?.name ?? 'current plan'}
          onDone={() => {
            setRequesting(false);
            toast.success('Request sent', 'We will confirm before anything changes.');
          }}
        />
      </Modal>
    </div>
  );
}

function PlanChangeRequest({ currentPlan, onDone }: { currentPlan: string; onDone: () => void }) {
  const [planName, setPlanName] = useState('');
  const [reason, setReason] = useState('');

  const mutation = useMutation(
    () =>
      requestsService.create({
        title: `Plan change request: ${planName}`,
        description: reason.trim() || `Requesting a change from ${currentPlan} to ${planName}.`,
        type: 'general',
        priority: 'medium',
      }),
    { onSuccess: onDone },
  );

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        await mutation.mutate().catch(() => undefined);
      }}
      className="space-y-4"
    >
      <p className="text-[13px] leading-relaxed text-muted">
        Tell us which plan you would like. We will confirm the change and it takes effect from your next billing cycle.
      </p>
      <Select
        label="Requested plan"
        required
        placeholder="Select…"
        value={planName}
        onChange={(event) => setPlanName(event.target.value)}
        options={[
          { value: 'lead', label: 'LEAD' },
          { value: 'Growth', label: 'Growth' },
          { value: 'Pro', label: 'Pro' },
          { value: 'Custom', label: 'Custom / talk to us first' },
        ]}
      />
      <Input
        label="Anything else?"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        hint="Optional — what is driving the change?"
      />
      {mutation.error ? <p className="text-xs text-danger">{mutation.error}</p> : null}
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button size="sm" type="submit" loading={mutation.pending} disabled={!planName}>
          Send request
        </Button>
      </div>
    </form>
  );
}
