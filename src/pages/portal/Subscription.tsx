import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Check, CheckCircle2 } from 'lucide-react';
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
import { cn } from '@/lib/cn';
import type { Invoice, Plan, Subscription as SubscriptionRecord } from '@/types';

/**
 * Subscription (spec §2–§4, §55, §112).
 *
 * Two distinct actions live here and are deliberately never merged:
 *
 *   • REQUEST A PLAN CHANGE — a message to the team, applied from the next
 *     cycle. Nothing changes until we confirm it.
 *   • CANCEL PLAN — a real, immediate change: renewal stops and the record
 *     moves to cancellation_pending (or cancelled when nothing is
 *     outstanding). The subscription is never deleted, and an invoice that
 *     has already been issued is never silently voided.
 */

const CANCELLATION_REASONS = [
  'Too expensive for now',
  'No longer need the service',
  'Missing a feature I need',
  'Switching to another provider',
  'Pausing the business',
  'Other',
];

/** Human label + tone for every lifecycle state the database can hold. */
function statusMeta(status: SubscriptionRecord['status']) {
  switch (status) {
    case 'active':
      return { label: 'Active', tone: 'success' as const, hint: 'Renews automatically' };
    case 'trialing':
      return { label: 'Trial', tone: 'info' as const, hint: 'Converts when the trial ends' };
    case 'cancellation_pending':
      return { label: 'Cancellation pending', tone: 'warning' as const, hint: 'Will not renew' };
    case 'past_due':
      return { label: 'Past due', tone: 'danger' as const, hint: 'A payment is outstanding' };
    case 'paused':
      return { label: 'Paused', tone: 'warning' as const, hint: 'Nothing is being billed' };
    case 'cancelled':
      return { label: 'Cancelled', tone: 'neutral' as const, hint: 'No further billing' };
    case 'expired':
      return { label: 'Expired', tone: 'neutral' as const, hint: 'The paid period ended' };
    default:
      return { label: status, tone: 'neutral' as const, hint: undefined };
  }
}

export default function Subscription() {
  usePageMeta({ title: 'My subscription', noIndex: true });
  const toast = useToast();
  const [requesting, setRequesting] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const subs = useAsync(() => billingService.subscriptions(), []);
  const plans = useAsync(() => billingService.plans(), []);
  const invoices = useAsync(() => billingService.invoices(), []);

  const availablePlans = plans.data?.plans ?? [];

  const subscription = subs.data?.items?.[0] ?? null;
  const plan = plans.data?.plans?.find((item) => item.id === subscription?.planId) ?? null;

  const openInvoices = useMemo(
    () => (invoices.data?.items ?? []).filter((invoice) => invoice.status === 'open' || invoice.status === 'draft'),
    [invoices.data],
  );

  const meta = subscription ? statusMeta(subscription.status) : null;

  /** Cancellation is offered only while there is something to stop. */
  const cancellable =
    subscription !== null &&
    ['active', 'trialing', 'past_due', 'paused'].includes(subscription.status);

  return (
    <div>
      <PortalHeader
        title="My subscription"
        description="Your plan, renewal date and billing history."
        demo={subscription?.isDemo}
        action={
          subscription ? (
            <div className="flex flex-wrap gap-2">
              {cancellable ? (
                <Button variant="secondary" size="sm" onClick={() => setCancelling(true)}>
                  Cancel plan
                </Button>
              ) : null}
              <Button size="sm" onClick={() => setRequesting(true)}>
                Request a plan change
              </Button>
            </div>
          ) : undefined
        }
      />

      <AsyncBoundary
        loading={subs.loading}
        error={subs.error}
        data={subs.data}
        isEmpty={(payload) => !payload.items?.length}
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
            {subscription.status === 'cancellation_pending' ? (
              <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/[0.06] p-4">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
                <div>
                  <p className="text-[13px] font-medium text-fg">
                    Your plan will not renew. Access continues until {formatDate(subscription.cancelAt)}.
                  </p>
                  <p className="mt-1 text-[13px] text-muted">
                    Nothing further will be billed. If you would like to continue after that date, tell us before it
                    passes and we will restart the plan.
                  </p>
                </div>
              </div>
            ) : null}

            {subscription.status === 'cancelled' || subscription.status === 'expired' ? (
              <div className="flex items-start gap-3 rounded-lg border border-line bg-sunken/40 p-4">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
                <div>
                  <p className="text-[13px] font-medium text-fg">This subscription has ended.</p>
                  <p className="mt-1 text-[13px] text-muted">
                    {subscription.cancelledAt ? `Cancelled on ${formatDate(subscription.cancelledAt)}. ` : ''}
                    No further billing will be raised. Your invoices and history stay available in{' '}
                    <Link to="/portal/invoices" className="text-brand hover:underline">
                      Invoices
                    </Link>
                    .
                  </p>
                </div>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard label="Plan" value={plan?.name ?? 'Custom'} hint={plan?.tagline} />
              <KpiCard
                label="Amount"
                value={
                  plan?.amount !== null && plan?.amount !== undefined
                    ? `${formatMoney(plan.amount)} / ${plan.intervalDays} days`
                    : 'Custom'
                }
                hint="Billed in advance"
              />
              <KpiCard
                label={subscription.status === 'cancellation_pending' ? 'Ends' : 'Renews'}
                value={formatDate(subscription.cancelAt ?? subscription.renewsAt)}
                hint={formatDaysUntil(subscription.cancelAt ?? subscription.renewsAt) ?? undefined}
              />
              <KpiCard
                label="Billing status"
                value={<StatusIndicator status={meta?.label ?? subscription.status} tone={meta?.tone ?? 'neutral'} />}
                hint={meta?.hint}
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
                  {subscription.cancellationReason ? (
                    <MetricRow label="Reason recorded" value={subscription.cancellationReason} />
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
          plans={availablePlans}
          onDone={() => {
            setRequesting(false);
            toast.success('Request sent', 'We will confirm before anything changes.');
          }}
        />
      </Modal>

      {subscription && cancellable ? (
        <Modal
          open={cancelling}
          onClose={() => setCancelling(false)}
          title="Cancel your plan"
          size="md"
        >
          <CancelPlan
            subscription={subscription}
            plan={plan}
            openInvoices={openInvoices}
            onClose={() => setCancelling(false)}
            onDone={() => {
              void subs.refetch().catch(() => undefined);
              void invoices.refetch().catch(() => undefined);
            }}
          />
        </Modal>
      ) : null}
    </div>
  );
}

/**
 * The cancellation flow (spec §2–§4).
 *
 * Step 1 explains exactly what cancelling changes before anything is sent.
 * Step 2 is the confirmation screen, which states the plan, the billing
 * status, the effective date, what happens to access and whether future
 * billing stops — and is explicit that invoices already issued are
 * untouched, because that is what the billing system actually does.
 */
function CancelPlan({
  subscription,
  plan,
  openInvoices,
  onClose,
  onDone,
}: {
  subscription: SubscriptionRecord;
  plan: Plan | null;
  openInvoices: Invoice[];
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [result, setResult] = useState<{ status: SubscriptionRecord['status']; effectiveAt: string | null } | null>(
    null,
  );

  /** End of the already-paid period, when there is one. */
  const periodEnd = subscription.renewsAt && new Date(subscription.renewsAt) > new Date() ? subscription.renewsAt : null;
  const reasonValue = reason === 'Other' ? note.trim() || 'Other' : [reason, note.trim()].filter(Boolean).join(' — ');

  const cancel = useMutation(() => billingService.cancelSubscription(subscription.id, reasonValue), {
    onSuccess: (payload) => {
      setResult(payload);
      onDone();
      toast.success('Plan cancelled', 'We have emailed nothing — your confirmation is on this screen.');
    },
  });

  if (result) {
    const pending = result.status === 'cancellation_pending';
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg border border-success/30 bg-success/[0.06] p-4">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
          <div>
            <p className="text-[13px] font-medium text-fg">
              {pending ? 'Your plan will not renew.' : 'Your plan has been cancelled.'}
            </p>
            <p className="mt-1 text-[13px] text-muted">
              A record of this was added to your account and the NorthForge team has been notified.
            </p>
          </div>
        </div>

        <dl className="divide-y divide-line rounded-lg border border-line">
          <Row label="Plan" value={plan?.name ?? 'Custom'} />
          <Row label="Billing status" value={pending ? 'Cancellation pending' : 'Cancelled'} />
          <Row
            label={pending ? 'Access ends' : 'Access ended'}
            value={formatDate(result.effectiveAt)}
          />
          <Row
            label="Current period access"
            value={pending ? 'Continues until the date above — you have paid for it.' : 'Ended on the date above.'}
          />
          <Row label="Future billing" value="Stopped. No further renewals or invoices will be raised." />
          <Row
            label="Invoices already issued"
            value={
              openInvoices.length
                ? `${openInvoices.length} invoice${openInvoices.length === 1 ? '' : 's'} already issued keep their own status and remain payable.`
                : 'None outstanding. Historical invoices are kept as financial records.'
            }
          />
        </dl>

        <p className="text-xs leading-relaxed text-faint">
          Cancelling a plan does not close your account. Your workspace, history and files stay available — only
          future billing stops. Manage everything else from{' '}
          <Link to="/portal/settings" className="text-brand hover:underline" onClick={onClose}>
            Settings
          </Link>
          .
        </p>

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-[13px] leading-relaxed text-muted">
        This stops your plan from renewing. It does not delete your subscription, your workspace or any invoice.
      </p>

      <dl className="divide-y divide-line rounded-lg border border-line">
        <Row label="Plan" value={plan?.name ?? 'Custom'} />
        <Row label="Billing status now" value={statusMeta(subscription.status).label} />
        <Row
          label={periodEnd ? 'Access continues until' : 'Access ends'}
          value={periodEnd ? formatDate(periodEnd) : 'Immediately'}
        />
        <Row label="Next renewal" value="Will not happen" />
        <Row
          label="Invoices already issued"
          value={
            openInvoices.length
              ? `${openInvoices.length} already issued (${formatMoney(
                  openInvoices.reduce((sum, invoice) => sum + invoice.total, 0),
                )}) — unchanged and still payable.`
              : 'None outstanding. Paid invoices are kept as financial records.'
          }
        />
      </dl>

      <Select
        label="Why are you cancelling?"
        placeholder="Prefer not to say"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        options={CANCELLATION_REASONS.map((item) => ({ value: item, label: item }))}
      />
      <Input
        label={reason === 'Other' ? 'Tell us more (optional)' : 'Anything else? (optional)'}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        hint="Recorded on your account and shown to the team — never used for marketing."
      />

      {cancel.error ? <p className="text-xs text-danger">{cancel.error}</p> : null}

      <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Keep my plan
        </Button>
        <Button
          size="sm"
          className="bg-danger text-white hover:bg-danger/90"
          loading={cancel.pending}
          onClick={() => cancel.mutate().catch(() => undefined)}
        >
          Confirm cancellation
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: React.ReactNode; tone?: 'warning' }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-2.5">
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className={cn('max-w-[60%] text-right text-[13px] font-medium text-fg', tone === 'warning' && 'text-warning')}>
        {value}
      </dd>
    </div>
  );
}

function PlanChangeRequest({
  currentPlan,
  plans,
  onDone,
}: {
  currentPlan: string;
  plans: Plan[];
  onDone: () => void;
}) {
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
      {/* Options come from the live catalog — never a hardcoded list that
          can drift from what actually exists. */}
      <Select
        label="Requested plan"
        required
        placeholder="Select…"
        value={planName}
        onChange={(event) => setPlanName(event.target.value)}
        options={[
          ...plans.map((item) => ({
            value: item.name,
            label: `${item.name} · ${item.amount !== null ? formatMoney(item.amount) : 'Custom'}`,
          })),
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
