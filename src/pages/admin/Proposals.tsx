import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, FileText, XCircle } from 'lucide-react';
import { Panel, KpiCard } from '@/components/ui/Card';
import { AsyncBoundary, EmptyState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Badge';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Button } from '@/components/ui/Button';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useToast } from '@/app/providers/ToastProvider';
import { leadsService } from '@/services';
import { SERVICES } from '@shared/catalog';
import { formatMoney, titleCase } from '@/lib/format';

/**
 * Proposals (spec §113).
 *
 * A proposal is built from the central catalog — never a hand-typed figure —
 * so what a prospect is quoted always matches what the system bills.
 */
export default function Proposals() {
  usePageMeta({ title: 'Proposals', noIndex: true });
  const toast = useToast();
  const [selected, setSelected] = useState<string[]>([]);
  const state = useAsync(() => leadsService.list({ status: 'proposal', pageSize: 100 }), []);
  const items = state.data?.items ?? [];

  const setStatus = useMutation(
    (input: { id: string; contactName: string; status: 'won' | 'lost' }) => leadsService.update(input.id, { status: input.status }),
    {
      onSuccess: async (_result, input) => {
        toast.success(`${input.contactName} marked ${input.status}`);
        await state.refetch().catch(() => undefined);
      },
    },
  );

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));

  const total = selected.reduce((sum, id) => {
    const lead = items.find((item) => item.id === id);
    return sum + (lead?.value ?? 0);
  }, 0);

  return (
    <div>
      <AdminHeader
        title="Proposals"
        description="Leads at proposal stage, priced from the service catalog."
        crumbs={[{ label: 'Proposals' }]}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <KpiCard label="At proposal stage" value={items.length} />
        <KpiCard label="Selected" value={selected.length} />
        <KpiCard label="Selected value" value={formatMoney(total, { compact: true })} />
      </div>

      <AsyncBoundary
        loading={state.loading}
        error={state.error}
        data={state.data}
        onRetry={() => state.refetch().catch(() => undefined)}
      >
        {items.length ? (
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
            <Panel bodyClassName="p-0">
              <ul className="divide-y divide-line">
                {items.map((lead) => (
                  <li key={lead.id} className="flex items-center gap-3 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.includes(lead.id)}
                      onChange={() => toggle(lead.id)}
                      aria-label={`Select ${lead.contactName}`}
                      className="h-3.5 w-3.5 accent-[rgb(var(--nf-blue))]"
                    />
                    <div className="min-w-0 flex-1">
                      <Link to={`/app/leads/${lead.id}`} className="block truncate text-[13px] font-medium text-fg hover:underline">
                        {lead.contactName}
                        {lead.businessName ? <span className="text-muted"> · {lead.businessName}</span> : null}
                      </Link>
                      <p className="truncate text-2xs text-muted">{lead.nextAction ?? 'No next action set'}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {lead.value ? <span className="nf-num text-[13px] text-fg">{formatMoney(lead.value)}</span> : null}
                      <Badge tone="warning">{titleCase(lead.status)}</Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Mark ${lead.contactName} as won`}
                        onClick={() => void setStatus.mutate({ id: lead.id, contactName: lead.contactName, status: 'won' }).catch(() => undefined)}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Mark ${lead.contactName} as lost`}
                        onClick={() => void setStatus.mutate({ id: lead.id, contactName: lead.contactName, status: 'lost' }).catch(() => undefined)}
                      >
                        <XCircle className="h-3.5 w-3.5 text-danger" aria-hidden />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel title="Catalog pricing">
              <p className="text-[13px] leading-relaxed text-muted">
                Every proposal line comes from the central service catalog. Editing a price changes it everywhere —
                no stray numbers in documents.
              </p>
              <ul className="mt-4 space-y-2">
                {SERVICES.filter((service) => service.unit !== 'included' && service.priceFrom !== null).slice(0, 8).map((service) => (
                  <li key={service.id} className="flex items-baseline justify-between gap-3 border-b border-line py-2 last:border-0">
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] text-fg">{service.name}</span>
                      <span className="text-2xs uppercase tracking-wider text-faint">{service.group}</span>
                    </span>
                    <span className="nf-num shrink-0 text-[13px] font-medium text-fg">
                      {service.unit === 'quoted' ? 'Quoted' : formatMoney(service.priceFrom)}
                    </span>
                  </li>
                ))}
              </ul>
              <Link to="/app/services" className="mt-3 inline-block text-[13px] text-brand hover:underline">
                Manage catalog →
              </Link>
            </Panel>
          </div>
        ) : (
          <EmptyState
            title="No proposals out"
            description="Move a lead to the proposal stage and it appears here."
            icon={<FileText className="h-4 w-4" />}
          />
        )}
      </AsyncBoundary>

      <Panel className="mt-4" title="Closing a proposal">
        <p className="text-[13px] leading-relaxed text-muted">
          Mark a proposal won or lost with the ✓ / ✕ buttons — the CRM, pipeline and analytics update from the same
          record. Marking one won does not create an invoice; generate that from the subscription once the client is
          onboarded.
        </p>
      </Panel>
    </div>
  );
}
