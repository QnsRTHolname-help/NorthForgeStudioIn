import { useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { Panel, KpiCard } from '@/components/ui/Card';
import { AsyncBoundary, EmptyState } from '@/components/ui/States';
import { Badge, StatusIndicator } from '@/components/ui/Badge';
import { AdminHeader, ListToolbar } from '@/components/admin/AdminHeader';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useToast } from '@/app/providers/ToastProvider';
import { billingService, clientsService } from '@/services';
import { getPlanById } from '@shared/catalog';
import { formatDate, formatDaysUntil, formatMoney, titleCase } from '@/lib/format';

const STATUSES = ['trialing', 'active', 'past_due', 'paused', 'cancelled'];

/** Subscriptions (spec §123): every client's plan and renewal state. */
export default function Subscriptions() {
  usePageMeta({ title: 'Subscriptions', noIndex: true });
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [planId, setPlanId] = useState('');
  const [nextStatus, setNextStatus] = useState('');

  const state = useAsync(() => billingService.subscriptions(), []);
  const plans = useAsync(() => billingService.plans(), []);
  const clients = useAsync(() => clientsService.list({ pageSize: 200 }), []);
  const clientName = (id: string) => clients.data?.items.find((client) => client.id === id)?.businessName ?? 'Unknown';

  const items = (state.data?.items ?? []).filter((subscription) => {
    const matchesQuery = !query || clientName(subscription.clientId).toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (!status || subscription.status === status);
  });

  const active = items.filter((subscription) => subscription.status === 'active');
  const mrr = active.reduce((sum, subscription) => {
    const plan = getPlanById(subscription.planId);
    return sum + (plan?.amount ?? 0);
  }, 0);

  const update = useMutation(
    (input: { id: string; planId?: string; status?: string }) => billingService.updateSubscription(input.id, input),
    {
      onSuccess: async () => {
        toast.success('Subscription updated');
        setEditing(null);
        await state.refetch().catch(() => undefined);
      },
    },
  );

  return (
    <div>
      <AdminHeader
        title="Subscriptions"
        description="Plan, renewal date and status for every client, on a monthly cycle."
        crumbs={[{ label: 'Billing', to: '/app/invoices' }, { label: 'Subscriptions' }]}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <KpiCard label="Active subscriptions" value={active.length} />
        <KpiCard label="Recurring revenue / cycle" value={formatMoney(mrr, { compact: true })} />
        <KpiCard label="Past due" value={items.filter((subscription) => subscription.status === 'past_due').length} />
      </div>

      <ListToolbar
        search={query}
        onSearch={setQuery}
        searchPlaceholder="Search by client…"
        filters={[
          {
            label: 'Status',
            value: status,
            onChange: setStatus,
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
              {items.map((subscription) => {
                const plan = getPlanById(subscription.planId);
                return (
                  <li key={subscription.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <span className="min-w-0 flex-1">
                      <Link
                        to={`/app/clients/${subscription.clientId}`}
                        className="block truncate text-[13px] font-medium text-fg hover:underline"
                      >
                        {clientName(subscription.clientId)}
                      </Link>
                      <span className="block text-2xs text-muted">
                        {plan?.name ?? 'Custom plan'} · {plan?.amount ? formatMoney(plan.amount) : '—'} /{' '}
                        {plan?.intervalDays ?? 28} days
                      </span>
                    </span>
                    <span className="shrink-0 text-2xs text-faint">
                      Renews {formatDate(subscription.renewsAt)}
                      {formatDaysUntil(subscription.renewsAt) ? ` (${formatDaysUntil(subscription.renewsAt)})` : ''}
                    </span>
                    <StatusIndicator
                      status={subscription.status}
                      tone={subscription.status === 'active' ? 'success' : subscription.status === 'past_due' ? 'danger' : 'warning'}
                    />
                    <Button variant="ghost" size="sm" onClick={() => { setEditing(subscription.id); setPlanId(subscription.planId); setNextStatus(subscription.status); }}>
                      Change
                    </Button>
                  </li>
                );
              })}
            </ul>
          </Panel>
        ) : (
          <EmptyState
            title="No subscriptions yet"
            description="Create a subscription when a client goes live."
            icon={<RefreshCw className="h-4 w-4" />}
          />
        )}
      </AsyncBoundary>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Change subscription">
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (!editing) return;
            await update
              .mutate({
                id: editing,
                planId: planId || undefined,
                status: nextStatus || undefined,
              })
              .catch(() => undefined);
          }}
          className="space-y-4"
        >
          <Select
            label="Plan"
            value={planId}
            onChange={(event) => setPlanId(event.target.value)}
            options={[{ value: '', label: 'Keep current plan' }, ...(plans.data?.plans ?? []).map((plan) => ({ value: plan.id, label: plan.name }))]}
          />
          <Select
            label="Status"
            value={nextStatus}
            onChange={(event) => setNextStatus(event.target.value)}
            options={[{ value: '', label: 'Keep current status' }, ...STATUSES.map((value) => ({ value, label: titleCase(value) }))]}
          />
          {update.error ? <p className="text-xs text-danger">{update.error}</p> : null}
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button size="sm" type="submit" loading={update.pending}>
              Save changes
            </Button>
          </div>
        </form>
      </Modal>

      <Panel className="mt-6" title="Changing a plan">
        <p className="text-[13px] leading-relaxed text-muted">
          Changes take effect from the client's next billing cycle. Their history stays intact and the invoice trail is
          never rewritten — which is what makes the numbers trustworthy later.
        </p>
      </Panel>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {items.filter((subscription) => subscription.isDemo).length ? (
          <Badge tone="neutral">{items.filter((subscription) => subscription.isDemo).length} demo subscriptions</Badge>
        ) : null}
      </div>
    </div>
  );
}
