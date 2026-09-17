import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Panel, KpiCard } from '@/components/ui/Card';
import { AsyncBoundary, EmptyState } from '@/components/ui/States';
import { Badge, StatusIndicator } from '@/components/ui/Badge';
import { AdminHeader, ListToolbar } from '@/components/admin/AdminHeader';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { Input, Select } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { ClientSelect } from '@/components/admin/ClientSelect';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useToast } from '@/app/providers/ToastProvider';
import { billingService, clientsService } from '@/services';
import { getPlanById, PLANS } from '@shared/catalog';
import { planPriceSummary } from '@/lib/billing';
import { formatDate, formatDaysUntil, formatMoney, titleCase } from '@/lib/format';
import type { Subscription } from '@/types';

const STATUSES = ['trialing', 'active', 'past_due', 'paused', 'cancelled'];

/** Subscriptions (spec §123): every client's plan, price and renewal state. */
export default function Subscriptions() {
  usePageMeta({ title: 'Subscriptions', noIndex: true });
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [newClientId, setNewClientId] = useState('');
  const [newPlanId, setNewPlanId] = useState('');
  const [newStatus, setNewStatus] = useState('active');
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [planId, setPlanId] = useState('');
  const [nextStatus, setNextStatus] = useState('');
  const [renewsAt, setRenewsAt] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<Subscription | null>(null);

  const state = useAsync(() => billingService.subscriptions(), []);
  const clients = useAsync(() => clientsService.list({ pageSize: 200 }), []);
  const clientName = (id: string) => clients.data?.items.find((client) => client.id === id)?.businessName ?? 'Unknown client';

  const items = (state.data?.items ?? []).filter((subscription) => {
    const matchesQuery = !query || clientName(subscription.clientId).toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (!status || subscription.status === status);
  });

  // Recurring revenue counts ACTIVE subscriptions only, priced from the
  // catalog's monthly amount (setup fees are one-time and never in MRR).
  const active = items.filter((subscription) => subscription.status === 'active');
  const mrr = active.reduce((sum, subscription) => sum + (getPlanById(subscription.planId)?.amount ?? 0), 0);

  const create = useMutation(
    (input: { clientId: string; planId: string; status: string }) => billingService.createSubscription(input),
    {
      onSuccess: async () => {
        toast.success('Subscription created');
        setCreating(false);
        setNewClientId('');
        setNewPlanId('');
        setNewStatus('active');
        await state.refetch().catch(() => undefined);
      },
    },
  );

  const update = useMutation(
    (input: { id: string; planId?: string; status?: string; renewsAt?: string }) => billingService.updateSubscription(input.id, input),
    {
      onSuccess: async () => {
        toast.success('Subscription updated');
        setEditing(null);
        await state.refetch().catch(() => undefined);
      },
    },
  );

  const remove = useMutation((id: string) => billingService.deleteSubscription(id), {
    onSuccess: async () => {
      toast.success('Subscription deleted');
      setConfirmDelete(null);
      await state.refetch().catch(() => undefined);
    },
  });

  const openEdit = (subscription: Subscription) => {
    setEditing(subscription);
    setPlanId(subscription.planId);
    setNextStatus(subscription.status);
    setRenewsAt(subscription.renewsAt ? subscription.renewsAt.slice(0, 10) : '');
  };

  const selectedNewPlan = getPlanById(newPlanId);

  return (
    <div>
      <AdminHeader
        title="Subscriptions"
        description="Plan, price and renewal date for every client, billed on the catalog cycle."
        crumbs={[{ label: 'Billing', to: '/app/invoices' }, { label: 'Subscriptions' }]}
        action={
          <Button size="md" iconLeft={<Plus className="h-3.5 w-3.5" />} onClick={() => setCreating(true)}>
            New subscription
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <KpiCard label="Active subscriptions" value={active.length} />
        <KpiCard label="Recurring revenue / cycle" value={formatMoney(mrr, { compact: true })} hint="Active subscriptions, monthly management only" />
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
        isEmpty={(data) => data.items.length === 0}
        onRetry={() => state.refetch().catch(() => undefined)}
        empty={
          <EmptyState
            title="No subscriptions yet"
            description="Create one when a client goes live — it drives renewals, invoices and recurring revenue."
            icon={<RefreshCw className="h-4 w-4" />}
            action={
              <Button variant="secondary" size="sm" onClick={() => setCreating(true)}>
                New subscription
              </Button>
            }
          />
        }
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
                        {plan ? `${plan.name} · ${formatMoney(plan.amount ?? 0)} / ${plan.intervalDays ?? 30} days` : 'Plan removed from catalog'}
                        {plan?.setupAmount ? ` · setup ${formatMoney(plan.setupAmount)}` : ''}
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
                    <Button variant="ghost" size="sm" onClick={() => openEdit(subscription)}>
                      Change
                    </Button>
                  </li>
                );
              })}
            </ul>
          </Panel>
        ) : (
          <EmptyState title="No subscriptions match" description="Clear the search or status filter." icon={<RefreshCw className="h-4 w-4" />} />
        )}
      </AsyncBoundary>

      {/* ── Create ─────────────────────────────────────────────── */}
      <Modal open={creating} onClose={() => setCreating(false)} title="New subscription">
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            await create.mutate({ clientId: newClientId, planId: newPlanId, status: newStatus }).catch(() => undefined);
          }}
          className="space-y-4"
        >
          <ClientSelect label="Client" value={newClientId} onChange={setNewClientId} required />
          <Select
            label="Plan"
            value={newPlanId}
            onChange={(event) => setNewPlanId(event.target.value)}
            required
            options={[
              { value: '', label: 'Choose a plan…' },
              ...PLANS.filter((plan) => plan.amount !== null).map((plan) => ({
                value: plan.id,
                label: `${plan.name} — ${planPriceSummary(plan)}`,
              })),
            ]}
          />
          <Select
            label="Starting status"
            value={newStatus}
            onChange={(event) => setNewStatus(event.target.value)}
            options={STATUSES.map((value) => ({ value, label: titleCase(value) }))}
            hint="The renewal date is set from the plan's own billing interval."
          />
          {selectedNewPlan ? (
            <p className="rounded border border-line bg-sunken/40 px-3 py-2 text-xs text-muted">
              {selectedNewPlan.name}: {planPriceSummary(selectedNewPlan)}.
            </p>
          ) : null}
          {create.error ? <p className="text-xs text-danger">{create.error}</p> : null}
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button size="sm" type="submit" loading={create.pending} disabled={!newClientId || !newPlanId}>
              Create subscription
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Edit ───────────────────────────────────────────────── */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Change subscription">
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (!editing) return;
            await update
              .mutate({
                id: editing.id,
                planId: planId || undefined,
                status: nextStatus || undefined,
                renewsAt: renewsAt ? new Date(`${renewsAt}T12:00:00`).toISOString() : undefined,
              })
              .catch(() => undefined);
          }}
          className="space-y-4"
        >
          <Select
            label="Plan"
            value={planId}
            onChange={(event) => setPlanId(event.target.value)}
            options={[
              { value: '', label: 'Keep current plan' },
              ...PLANS.filter((plan) => plan.amount !== null).map((plan) => ({ value: plan.id, label: plan.name })),
            ]}
            hint="A plan change applies from the next cycle — history and past invoices are never rewritten."
          />
          <Select
            label="Status"
            value={nextStatus}
            onChange={(event) => setNextStatus(event.target.value)}
            options={STATUSES.map((value) => ({ value, label: titleCase(value) }))}
          />
          <Input
            label="Next renewal date"
            type="date"
            value={renewsAt}
            onChange={(event) => setRenewsAt(event.target.value)}
            hint="Shift this when a payment lands late or a cycle is paused."
          />
          {update.error ? <p className="text-xs text-danger">{update.error}</p> : null}
          <div className="flex flex-wrap justify-between gap-2 border-t border-line pt-4">
            <Button
              variant="ghost"
              size="sm"
              className="text-danger"
              iconLeft={<Trash2 className="h-3.5 w-3.5" />}
              onClick={() => editing && setConfirmDelete(editing)}
            >
              Delete
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button size="sm" type="submit" loading={update.pending}>
                Save changes
              </Button>
            </div>
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
        title="Delete this subscription?"
        description="Linked invoices are kept and their subscription link is cleared. To stop billing but keep history, set the status to cancelled instead."
        confirmLabel="Delete subscription"
        destructive
        pending={remove.pending}
      />

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
